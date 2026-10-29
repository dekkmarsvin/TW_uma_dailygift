const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { chromium } = require('playwright');
const logger = require('./logger');
const { loadCookies, saveCookies } = require('./core/cookieStore');
const { getEventWindow, parseOptions } = require('./island/policy');
const { IslandPageAdapter, installReadOnlyGuard } = require('./island/pageAdapter');
const { runIsland } = require('./island/runner');

async function run(argv = process.argv.slice(2), dependencies = {}) {
    const { claim } = parseOptions(argv);
    const env = dependencies.env || process.env;
    const clock = dependencies.clock || (() => new Date());
    const activeLogger = dependencies.logger || logger;
    const eventWindow = () => getEventWindow(clock(), env.ISLAND_SUNSET_AT);
    if (!eventWindow().active) {
        activeLogger.info(`Island automation skipped: outside the event window (ends ${eventWindow().end}).`);
        return { dryRun: !claim, skipped: true, reason: 'island_outside_event_window' };
    }
    const browser = await (dependencies.chromium || chromium).launch({ headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
        const cookiePath = dependencies.cookiePath || path.join(__dirname, '../cookies.json');
        if (!await loadCookies({ context, cookiePath, logger: activeLogger })) {
            throw new Error('Island session unavailable. Run run_automation.ps1 to log in with the existing .env credentials.');
        }
        if (!claim) await installReadOnlyGuard(context);
        const page = await context.newPage();
        const result = await runIsland({
            adapter: new IslandPageAdapter(page), claim, logger: activeLogger,
            assertActive() {
                if (!eventWindow().active) throw new Error('Island event ended during this run; stopping.');
            }
        });
        if (claim) await saveCookies({ context, cookiePath, logger: activeLogger });
        activeLogger.info(`Island summary: ${JSON.stringify(result)}`);
        return result;
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    run().catch(error => { logger.error(`Island automation failed: ${error.message}`); process.exitCode = 1; });
}

module.exports = { run };
