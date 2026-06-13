const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isClaimableTask,
    collectClaimableTasks,
    summarizeTaskSections
} = require('../src/umamatch/taskPolicy');
const { UmamatchTaskClient } = require('../src/umamatch/taskClient');
const { runUmamatchTasks } = require('../src/umamatch/runner');

test('isClaimableTask only allows completed unclaimed active tasks', () => {
    assert.equal(isClaimableTask({
        taskId: 'ready',
        isCompleted: true,
        isRewarded: false,
        isEnd: false
    }), true);

    assert.equal(isClaimableTask({
        taskId: 'unfinished',
        isCompleted: false,
        isRewarded: false,
        isEnd: false
    }), false);

    assert.equal(isClaimableTask({
        taskId: 'claimed',
        isCompleted: true,
        isRewarded: true,
        isEnd: false
    }), false);

    assert.equal(isClaimableTask({
        taskId: 'not-open',
        isCompleted: true,
        isRewarded: false,
        rewardTimeStatus: 0
    }), false);
});

test('collectClaimableTasks keeps category context for eligible daily milestone and activity tasks', () => {
    const claimable = collectClaimableTasks({
        daily: [
            { taskId: 'daily-1', title: '每日登入賽事網頁', isCompleted: true, isRewarded: false, award: { POINT: 2 } },
            { taskId: 'daily-2', title: '每日登入遊戲', isCompleted: true, isRewarded: true, award: { POINT: 1 } }
        ],
        milestones: [
            { taskId: 'week-1', circleNum: 2, isCompleted: true, isRewarded: false, award: { POINT: 15, COUPON: 2 } }
        ],
        oneTime: [
            { taskId: 'activity-1', title: '首次登入賽事網頁', isCompleted: true, isRewarded: false, rewardTimeStatus: 1, award: { POINT: 20 } },
            { taskId: 'activity-2', title: '未開放活動', isCompleted: true, isRewarded: false, rewardTimeStatus: 0, award: { POINT: 20 } }
        ]
    });

    assert.deepEqual(claimable.map(task => ({
        category: task.category,
        taskId: task.taskId,
        title: task.title,
        awardText: task.awardText
    })), [
        {
            category: 'daily',
            taskId: 'daily-1',
            title: '每日登入賽事網頁',
            awardText: '2 points'
        },
        {
            category: 'milestone',
            taskId: 'week-1',
            title: '第 2 週累計任務',
            awardText: '15 points, 2 coupons'
        },
        {
            category: 'activity',
            taskId: 'activity-1',
            title: '首次登入賽事網頁',
            awardText: '20 points'
        }
    ]);
});

test('summarizeTaskSections counts completed rewarded and claimable tasks', () => {
    const summary = summarizeTaskSections({
        daily: [
            { taskId: 'daily-claimed', isCompleted: true, isRewarded: true },
            { taskId: 'daily-ready', isCompleted: true, isRewarded: false }
        ],
        milestones: [
            { taskId: 'week-pending', isCompleted: false, isRewarded: false }
        ],
        oneTime: [
            { taskId: 'activity-ready', isCompleted: true, isRewarded: false, rewardTimeStatus: 1 }
        ]
    });

    assert.deepEqual(summary, {
        daily: { total: 2, completed: 2, rewarded: 1, claimable: 1 },
        milestones: { total: 1, completed: 0, rewarded: 0, claimable: 0 },
        oneTime: { total: 1, completed: 1, rewarded: 0, claimable: 1 }
    });
});

test('runUmamatchTasks dry-run reports claimable tasks without claiming rewards', async () => {
    const claimed = [];
    const result = await runUmamatchTasks({
        claim: false,
        client: {
            async getDailyTasks() {
                return [{ taskId: 'daily-1', title: '每日登入賽事網頁', isCompleted: true, isRewarded: false, award: { POINT: 2 } }];
            },
            async getMilestoneTasks() {
                return [];
            },
            async getOneTimeTasks() {
                return [];
            },
            async claimReward(taskId) {
                claimed.push(taskId);
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(result.dryRun, true);
    assert.deepEqual(result.claimable.map(task => task.taskId), ['daily-1']);
    assert.deepEqual(result.claimResults, []);
    assert.deepEqual(claimed, []);
});

test('runUmamatchTasks claim mode claims only eligible tasks', async () => {
    const claimed = [];
    const result = await runUmamatchTasks({
        claim: true,
        client: {
            async getDailyTasks() {
                return [
                    { taskId: 'daily-ready', title: '每日登入賽事網頁', isCompleted: true, isRewarded: false, award: { POINT: 2 } },
                    { taskId: 'daily-done', title: '每日登入遊戲', isCompleted: true, isRewarded: true, award: { POINT: 1 } }
                ];
            },
            async getMilestoneTasks() {
                return [{ taskId: 'week-ready', circleNum: 2, isCompleted: true, isRewarded: false, award: { POINT: 15 } }];
            },
            async getOneTimeTasks() {
                return [{ taskId: 'activity-later', title: '未開放活動', isCompleted: true, isRewarded: false, rewardTimeStatus: 0, award: { POINT: 20 } }];
            },
            async claimReward(taskId) {
                claimed.push(taskId);
                return { taskId, ok: true };
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(result.dryRun, false);
    assert.deepEqual(claimed, ['daily-ready', 'week-ready']);
    assert.deepEqual(result.claimResults, [
        { taskId: 'daily-ready', ok: true },
        { taskId: 'week-ready', ok: true }
    ]);
});

test('runUmamatchTasks dry-run does not complete unfinished daily share task', async () => {
    let completeShareCalls = 0;
    const result = await runUmamatchTasks({
        claim: false,
        completeDailyShareTask: async () => {
            completeShareCalls++;
        },
        client: {
            async getDailyTasks() {
                return [
                    { taskId: 'uma-4-task3', title: '每日分享1次拼圖交換、徵求或贈送連結', isCompleted: false, isRewarded: false, award: { POINT: 2 } }
                ];
            },
            async getMilestoneTasks() {
                return [];
            },
            async getOneTimeTasks() {
                return [];
            },
            async claimReward() {
                throw new Error('dry-run should not claim');
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(completeShareCalls, 0);
    assert.deepEqual(result.claimable, []);
});

test('runUmamatchTasks claim mode completes unfinished daily share task before claiming refreshed rewards', async () => {
    let dailyReads = 0;
    let completeShareCalls = 0;
    const reportedShares = [];
    const claimed = [];

    const result = await runUmamatchTasks({
        claim: true,
        completeDailyShareTask: async task => {
            completeShareCalls++;
            assert.equal(task.taskId, 'uma-4-task3');
            return { completed: true };
        },
        client: {
            async getDailyTasks() {
                dailyReads++;
                if (dailyReads === 1) {
                    return [
                        { taskId: 'uma-4-task3', title: '每日分享1次拼圖交換、徵求或贈送連結', isCompleted: false, isRewarded: false, award: { POINT: 2 } }
                    ];
                }
                return [
                    { taskId: 'uma-4-task3', title: '每日分享1次拼圖交換、徵求或贈送連結', isCompleted: true, isRewarded: false, award: { POINT: 2 } }
                ];
            },
            async getMilestoneTasks() {
                return [];
            },
            async getOneTimeTasks() {
                return [];
            },
            async reportShare(taskId) {
                reportedShares.push(taskId);
                return { ok: true };
            },
            async claimReward(taskId) {
                claimed.push(taskId);
                return { ok: true };
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(completeShareCalls, 1);
    assert.deepEqual(reportedShares, ['uma-4-task3']);
    assert.equal(dailyReads, 3);
    assert.deepEqual(claimed, ['uma-4-task3']);
    assert.deepEqual(result.shareCompletion, { attempted: true, completed: true, reportShare: { ok: true } });
});

test('runUmamatchTasks claim mode refreshes after claims and picks up newly claimable milestone rewards', async () => {
    let dailyReads = 0;
    let milestoneReads = 0;
    const claimed = [];

    const result = await runUmamatchTasks({
        claim: true,
        client: {
            async getDailyTasks() {
                dailyReads++;
                if (dailyReads === 1) {
                    return [
                        { taskId: 'daily-ready', title: '每日登入賽事網頁', isCompleted: true, isRewarded: false, award: { POINT: 2 } }
                    ];
                }
                return [
                    { taskId: 'daily-ready', title: '每日登入賽事網頁', isCompleted: true, isRewarded: true, award: { POINT: 2 } }
                ];
            },
            async getMilestoneTasks() {
                milestoneReads++;
                if (milestoneReads < 2) {
                    return [
                        { taskId: 'week-ready', circleNum: 3, isCompleted: false, isRewarded: false, status: 0, award: { POINT: 15, COUPON: 2 } }
                    ];
                }
                return [
                    { taskId: 'week-ready', circleNum: 3, isCompleted: true, isRewarded: false, status: 1, award: { POINT: 15, COUPON: 2 } }
                ];
            },
            async getOneTimeTasks() {
                return [];
            },
            async claimReward(taskId) {
                claimed.push(taskId);
                return { ok: true };
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.deepEqual(claimed, ['daily-ready', 'week-ready']);
    assert.equal(result.claimResults.length, 2);
    assert.equal(result.claimRounds, 2);
});

test('UmamatchTaskClient reads task sections from the expected endpoints', async () => {
    const requests = [];
    const client = new UmamatchTaskClient({
        request: async ({ method, path, body }) => {
            requests.push({ method, path, body });
            return { code: 0, data: [`data:${path}`] };
        }
    });

    assert.deepEqual(await client.getDailyTasks(), ['data:/api/v1/client/task/list-daily']);
    assert.deepEqual(await client.getMilestoneTasks(), ['data:/api/v1/client/task/milestone']);
    assert.deepEqual(await client.getOneTimeTasks(), ['data:/api/v1/client/task/list-one-time']);

    assert.deepEqual(requests, [
        { method: 'GET', path: '/api/v1/client/task/list-daily', body: undefined },
        { method: 'GET', path: '/api/v1/client/task/milestone', body: undefined },
        { method: 'GET', path: '/api/v1/client/task/list-one-time', body: undefined }
    ]);
});

test('UmamatchTaskClient posts taskId when claiming a reward', async () => {
    const requests = [];
    const client = new UmamatchTaskClient({
        request: async ({ method, path, body }) => {
            requests.push({ method, path, body });
            return { code: 0, data: { claimed: true } };
        }
    });

    assert.deepEqual(await client.claimReward('uma-4-task1'), { claimed: true });
    assert.deepEqual(requests, [
        {
            method: 'POST',
            path: '/api/v1/client/task/claim-reward',
            body: { taskId: 'uma-4-task1' }
        }
    ]);
});

test('UmamatchTaskClient posts taskId when reporting a share task', async () => {
    const requests = [];
    const client = new UmamatchTaskClient({
        request: async ({ method, path, body }) => {
            requests.push({ method, path, body });
            return { code: 0, data: { reported: true } };
        }
    });

    assert.deepEqual(await client.reportShare('uma-4-task3'), { reported: true });
    assert.deepEqual(requests, [
        {
            method: 'POST',
            path: '/api/v1/client/task/report-share',
            body: { taskId: 'uma-4-task3' }
        }
    ]);
});

test('UmamatchTaskClient raises API errors with endpoint context', async () => {
    const client = new UmamatchTaskClient({
        request: async () => ({ code: 401, message: 'login required' })
    });

    await assert.rejects(
        () => client.getDailyTasks(),
        /\/api\/v1\/client\/task\/list-daily failed: login required \(401\)/
    );
});
