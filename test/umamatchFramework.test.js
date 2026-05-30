const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadCookies } = require('../src/core/cookieStore');
const { createPageRequest } = require('../src/umamatch/pageRequest');
const { parseCliOptions } = require('../src/umamatch/cli');
const { completeDailyShareTask } = require('../src/umamatch/dailyShareCompleter');

test('loadCookies adds cookies from a Playwright cookie file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umamatch-cookies-'));
    const cookiePath = path.join(dir, 'cookies.json');
    const cookies = [
        { name: 'SESSDATA', value: 'redacted', domain: '.komoejoy.com', path: '/' }
    ];
    fs.writeFileSync(cookiePath, JSON.stringify(cookies), 'utf8');

    const added = [];
    const loaded = await loadCookies({
        context: {
            async addCookies(nextCookies) {
                added.push(...nextCookies);
            }
        },
        cookiePath,
        logger: { info() {}, warn() {}, error() {} }
    });

    assert.equal(loaded, true);
    assert.deepEqual(added, cookies);
});

test('loadCookies returns false when the cookie file is absent', async () => {
    const added = [];
    const loaded = await loadCookies({
        context: {
            async addCookies(nextCookies) {
                added.push(...nextCookies);
            }
        },
        cookiePath: path.join(os.tmpdir(), 'missing-cookies.json'),
        logger: { info() {}, warn() {}, error() {} }
    });

    assert.equal(loaded, false);
    assert.deepEqual(added, []);
});

test('createPageRequest evaluates a browser fetch request with base URL and JSON body', async () => {
    const calls = [];
    const request = createPageRequest({
        page: {
            async evaluate(fn, payload) {
                calls.push(payload);
                return { code: 0, data: payload };
            }
        },
        baseUrl: 'https://example.test/base'
    });

    const result = await request({
        method: 'POST',
        path: '/api/v1/client/task/claim-reward',
        body: { taskId: 'uma-4-task1' }
    });

    assert.equal(result.code, 0);
    assert.deepEqual(calls, [
        {
            url: 'https://example.test/base/api/v1/client/task/claim-reward',
            method: 'POST',
            body: { taskId: 'uma-4-task1' }
        }
    ]);
});

test('parseCliOptions defaults to dry-run and only enables claiming with --claim', () => {
    assert.deepEqual(parseCliOptions([]), { claim: false });
    assert.deepEqual(parseCliOptions(['--dry-run']), { claim: false });
    assert.deepEqual(parseCliOptions(['--claim']), { claim: true });
});

test('parseCliOptions rejects unknown arguments', () => {
    assert.throws(
        () => parseCliOptions(['--unexpected']),
        /Unknown argument: --unexpected/
    );
});

test('completeDailyShareTask clicks go-complete and then an available share action', async () => {
    const operations = [];
    const page = {
        async goto(url, options) {
            operations.push({ op: 'goto', url, options });
        },
        async waitForTimeout(ms) {
            operations.push({ op: 'wait', ms });
        },
        async evaluate(fn) {
            const source = String(fn);
            if (source.includes('每日分享1次拼圖交換')) {
                operations.push({ op: 'click-go-complete' });
                return true;
            }
            if (source.includes('贈送') && source.includes('徵求') && source.includes('交換')) {
                operations.push({ op: 'click-share-action' });
                return { clicked: true, label: '贈送' };
            }
            throw new Error('unexpected evaluate callback');
        }
    };

    const result = await completeDailyShareTask({
        page,
        eventUrl: 'https://uma.komoejoy.com/umamatch/events/',
        logger: { info() {}, warn() {} }
    });

    assert.deepEqual(result, { completed: true, actionLabel: '贈送' });
    assert.deepEqual(operations, [
        {
            op: 'goto',
            url: 'https://uma.komoejoy.com/umamatch/events/task/',
            options: { waitUntil: 'domcontentloaded', timeout: 60000 }
        },
        { op: 'wait', ms: 2000 },
        { op: 'click-go-complete' },
        { op: 'wait', ms: 2000 },
        { op: 'click-share-action' },
        { op: 'wait', ms: 2000 }
    ]);
});

test('completeDailyShareTask falls back to task detail page when go-complete is unavailable', async () => {
    const operations = [];
    const page = {
        async goto(url) {
            operations.push({ op: 'goto', url });
        },
        async waitForTimeout() {},
        async evaluate(fn) {
            const source = String(fn);
            if (source.includes('每日分享1次拼圖交換')) {
                return false;
            }
            if (source.includes('贈送') && source.includes('徵求') && source.includes('交換')) {
                return { clicked: true, label: '交換' };
            }
            throw new Error('unexpected evaluate callback');
        }
    };

    const result = await completeDailyShareTask({
        page,
        eventUrl: 'https://uma.komoejoy.com/umamatch/events/',
        logger: { info() {}, warn() {} }
    });

    assert.deepEqual(result, { completed: true, actionLabel: '交換' });
    assert.deepEqual(operations.map(item => item.url), [
        'https://uma.komoejoy.com/umamatch/events/task/',
        'https://uma.komoejoy.com/umamatch/events/task-detail/'
    ]);
});
