const path = require('path');
const { chromium } = require('playwright');
const logger = require('./logger');
const { loadCookies, saveCookies } = require('./core/cookieStore');
const { UmamatchTaskClient } = require('./umamatch/taskClient');
const { createPageRequest } = require('./umamatch/pageRequest');
const { runUmamatchTasks } = require('./umamatch/runner');
const { parseCliOptions } = require('./umamatch/cli');

const COOKIE_PATH = path.join(__dirname, '../cookies.json');
const EVENT_URL = 'https://uma.komoejoy.com/umamatch/events/';
const API_BASE_URL = 'https://l11-activity-web-hk.komoejoy.com/uma';

async function run(argv = process.argv.slice(2)) {
    const options = parseCliOptions(argv);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    try {
        await loadCookies({ context, cookiePath: COOKIE_PATH, logger });
        const page = await context.newPage();
        await page.goto(EVENT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2000);

        const client = new UmamatchTaskClient({
            request: createPageRequest({ page, baseUrl: API_BASE_URL })
        });
        const result = await runUmamatchTasks({ client, claim: options.claim, logger });

        logger.info(`UMA Match task summary: ${JSON.stringify(result.summary)}`);
        for (const task of result.claimable) {
            logger.info(`Claimable: [${task.category}] ${task.title} (${task.taskId}) - ${task.awardText}`);
        }

        await saveCookies({ context, cookiePath: COOKIE_PATH, logger });
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
