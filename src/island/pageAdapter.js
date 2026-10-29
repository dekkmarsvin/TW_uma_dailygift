const { summarizeSnapshot } = require('./policy');

const EVENT_URL = 'https://uma.komoejoy.com/event/designyourisland/';
const API_ORIGIN = 'https://l11-activity-web-hk.komoejoy.com';
const API_PATH = '/activity/uma/island/';

function isEndpoint(response, endpoint, method = 'GET') {
    const url = new URL(response.url());
    return url.origin === API_ORIGIN && url.pathname === API_PATH + endpoint && response.request().method() === method;
}

async function installReadOnlyGuard(context) {
    // The official page reports LOGIN_PAGE automatically on load. Suppress it in dry-run,
    // but return the normal acknowledgement so the page can continue reading its status.
    await context.route(`${API_ORIGIN}/activity/**`, async route => {
        const request = route.request();
        if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.fallback();
        if (new URL(request.url()).pathname === API_PATH + 'task_report') {
            return route.fulfill({ json: { code: 0, message: 'Dry-run: task report suppressed', data: null } });
        }
        return route.abort('blockedbyclient');
    });
}

class IslandPageAdapter {
    constructor(page, { timeout = 20000 } = {}) {
        this.page = page;
        this.timeout = timeout;
    }

    async waitData(endpoint, method = 'GET') {
        let response;
        try {
            response = await this.page.waitForResponse(r => isEndpoint(r, endpoint, method), { timeout: this.timeout });
        } catch {
            throw new Error(`Island ${endpoint} did not respond; check session/login and network. No automatic retry was made.`);
        }
        if (!response.ok()) throw new Error(`Island ${endpoint}: HTTP ${response.status()}`);
        const body = await response.json();
        if (body?.code !== 0) throw new Error(`Island ${endpoint} failed (code ${body?.code ?? 'unknown'})`);
        return body.data;
    }

    async load() {
        const [role, status, tasks, draw] = await Promise.all([
            this.waitData('query_role'),
            this.waitData('status'),
            this.waitData('tasks'),
            this.waitData('material_draw/status'),
            this.page.goto(EVENT_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
        ]);
        if (!role?.role_id) throw new Error('Island requires a logged-in game account. Refresh cookies through run_automation.ps1.');
        const snapshot = { status, tasks, draw };
        summarizeSnapshot(snapshot);
        return snapshot;
    }

    async action(selector, endpoint) {
        // All writes come from the official UI, which handles its own session and signatures.
        // Never replay a mutation following a timeout: it may already have succeeded.
        const [result] = await Promise.all([
            this.waitData(endpoint, 'POST'),
            this.page.locator(selector).click({ timeout: this.timeout })
        ]);
        return result;
    }

    async browseStory(tab) {
        if (tab === 'PV') {
            await this.page.getByRole('button', { name: tab, exact: true }).click();
            await this.action('.play-video', 'task_report');
        } else {
            await Promise.all([
                this.waitData('task_report', 'POST'),
                this.page.getByRole('button', { name: tab, exact: true }).click()
            ]);
        }
        return this.load();
    }

    async build() {
        await this.action('.build-button', 'build');
        return this.load();
    }

    async claimRewards() {
        await this.action('.build-actions > button:nth-child(2)', 'share_award');
        // This button opens a local share poster. No Facebook/LINE/Discord action is selected.
        return this.load();
    }

    async draw() {
        const result = await this.action('.draw-button', 'material_draw');
        const prize = result?.material === true || String(result?.prize_id) === '2000072410'
            ? result : result?.draw_result?.success === true ? result.draw_result.prize : null;
        if (!prize?.prize_id) throw new Error('Island draw returned no verifiable prize. Check My Rewards before retrying.');
        return {
            prize: {
                id: String(prize.prize_id), name: prize.prize_name || prize.name || '',
                physical: result.material === true || String(prize.prize_id) === '2000072410'
            },
            snapshot: await this.load()
        };
    }
}

module.exports = { EVENT_URL, API_ORIGIN, API_PATH, IslandPageAdapter, installReadOnlyGuard, isEndpoint };
