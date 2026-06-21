const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { run } = require('../src/umamatchAutomation');

test('run skips umamatch without launching browser after overall sunset', async () => {
    let browserLaunched = false;
    const logs = [];

    const result = await run(['--dry-run'], {
        now: new Date('2026-07-06T04:59:00+08:00'),
        chromium: {
            async launch() {
                browserLaunched = true;
                throw new Error('browser should not launch after sunset');
            }
        },
        logger: {
            info(message) {
                logs.push(message);
            },
            warn(message) {
                logs.push(message);
            },
            error(message) {
                logs.push(message);
            }
        }
    });

    assert.equal(browserLaunched, false);
    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'umamatch_sunset');
    assert.match(logs.join('\n'), /UMA Match automation skipped/);
});

test('run skips task claims after task sunset but still checks lottery window', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umamatch-automation-'));
    const cookiePath = path.join(dir, 'cookies.json');
    const logs = [];
    const operations = [];
    const page = {
        async goto(url) {
            operations.push({ op: 'goto', url });
        },
        async waitForTimeout(ms) {
            operations.push({ op: 'wait', ms });
        },
        async evaluate() {
            return { code: 0, data: { guest: false, userId: 'user-1' } };
        }
    };
    const context = {
        async addCookies() {},
        async newPage() {
            return page;
        },
        async cookies() {
            return [];
        }
    };

    const result = await run(['--dry-run'], {
        now: new Date('2026-06-29T05:00:00+08:00'),
        chromium: {
            async launch() {
                return {
                    async newContext() {
                        return context;
                    },
                    async close() {
                        operations.push({ op: 'close' });
                    }
                };
            }
        },
        cookiePath,
        runTasks() {
            throw new Error('task runner should be skipped after task sunset');
        },
        async readLotteryWindowText() {
            operations.push({ op: 'read-lottery-window' });
            return '可以在2026年6月28日 14:00 ~ 2026年7月6日 04:59消耗抽獎券參與抽獎';
        },
        async runLottery() {
            operations.push({ op: 'run-lottery' });
            return { skipped: true, reason: 'no_lottery_tickets' };
        },
        logger: {
            info(message) {
                logs.push(message);
            },
            warn(message) {
                logs.push(message);
            },
            error(message) {
                logs.push(message);
            }
        }
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'umamatch_task_sunset');
    assert.deepEqual(result.lottery, { skipped: true, reason: 'no_lottery_tickets' });
    assert.deepEqual(operations.filter(item => item.op === 'read-lottery-window'), [{ op: 'read-lottery-window' }]);
    assert.deepEqual(operations.filter(item => item.op === 'run-lottery'), [{ op: 'run-lottery' }]);
    assert.match(logs.join('\n'), /UMA Match task rewards skipped/);
});
