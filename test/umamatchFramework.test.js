const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadCookies } = require('../src/core/cookieStore');
const { createPageRequest } = require('../src/umamatch/pageRequest');
const { parseCliOptions } = require('../src/umamatch/cli');

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
