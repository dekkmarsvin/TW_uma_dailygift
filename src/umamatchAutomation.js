const path = require('path');
require('dotenv').config({ quiet: true });
const { chromium } = require('playwright');
const logger = require('./logger');
const { loadCookies, saveCookies } = require('./core/cookieStore');
const { UmamatchTaskClient } = require('./umamatch/taskClient');
const { createPageRequest } = require('./umamatch/pageRequest');
const { runUmamatchTasks } = require('./umamatch/runner');
const { runUmamatchLottery } = require('./umamatch/lotteryRunner');
const { parseCliOptions } = require('./umamatch/cli');
const { completeDailyShareTask } = require('./umamatch/dailyShareCompleter');
const { readLotteryWindowText } = require('./umamatch/lotteryPage');
const {
    getUmamatchSunsetStatus,
    getUmamatchTaskSunsetStatus
} = require('./umamatch/sunsetPolicy');

const COOKIE_PATH = path.join(__dirname, '../cookies.json');
const EVENT_URL = 'https://uma.komoejoy.com/umamatch/events/';
const API_BASE_URL = 'https://l11-activity-web-hk.komoejoy.com/uma';

async function run(argv = process.argv.slice(2), dependencies = {}) {
    const options = parseCliOptions(argv);
    const activeLogger = dependencies.logger || logger;
    const sunsetStatus = getUmamatchSunsetStatus({
        env: dependencies.env || process.env,
        now: dependencies.now || new Date()
    });

    if (sunsetStatus.isSunset) {
        activeLogger.info(`UMA Match automation skipped: sunset reached at ${sunsetStatus.sunsetAt}.`);
        return {
            dryRun: !options.claim,
            skipped: true,
            reason: 'umamatch_sunset',
            sunsetAt: sunsetStatus.sunsetAt,
            now: sunsetStatus.now
        };
    }

    const activeChromium = dependencies.chromium || chromium;
    const cookiePath = dependencies.cookiePath || COOKIE_PATH;
    const browser = await activeChromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
        await loadCookies({ context, cookiePath, logger: activeLogger });
        const page = await context.newPage();
        await page.goto(EVENT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        const client = new UmamatchTaskClient({
            request: createPageRequest({ page, baseUrl: API_BASE_URL })
        });
        const userInfo = await client.assertLoggedIn();
        activeLogger.info(`UMA Match API login verified for user ${userInfo.userId}.`);

        const taskSunsetStatus = getUmamatchTaskSunsetStatus({
            env: dependencies.env || process.env,
            now: dependencies.now || new Date()
        });

        let result;
        if (taskSunsetStatus.isSunset) {
            activeLogger.info(`UMA Match task rewards skipped: task sunset reached at ${taskSunsetStatus.sunsetAt}.`);
            result = {
                dryRun: !options.claim,
                skipped: true,
                reason: 'umamatch_task_sunset',
                sunsetAt: taskSunsetStatus.sunsetAt,
                now: taskSunsetStatus.now
            };
        } else {
            const runTasks = dependencies.runTasks || runUmamatchTasks;
            result = await runTasks({
                client,
                claim: options.claim,
                logger: activeLogger,
                completeDailyShareTask: task => completeDailyShareTask({ page, eventUrl: EVENT_URL, logger: activeLogger, task })
            });

            activeLogger.info(`UMA Match task summary: ${JSON.stringify(result.summary)}`);
            for (const task of result.claimable) {
                activeLogger.info(`Claimable: [${task.category}] ${task.title} (${task.taskId}) - ${task.awardText}`);
            }
        }

        const activeReadLotteryWindowText = dependencies.readLotteryWindowText || readLotteryWindowText;
        const activeRunLottery = dependencies.runLottery || runUmamatchLottery;
        const lotteryWindowText = await activeReadLotteryWindowText({
            page,
            eventUrl: EVENT_URL,
            logger: activeLogger
        });
        result.lottery = await activeRunLottery({
            client,
            claim: options.claim,
            lotteryWindowText,
            now: dependencies.now || new Date(),
            logger: activeLogger
        });

        await saveCookies({ context, cookiePath, logger: activeLogger });
        return result;
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    run().catch(error => {
        logger.error(`UMA Match automation failed: ${error.message}`);
        process.exitCode = 1;
    });
}

module.exports = {
    run
};
