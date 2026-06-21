const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseLotteryWindowText,
    getLotteryWindowStatus
} = require('../src/umamatch/lotteryPolicy');
const { runUmamatchLottery } = require('../src/umamatch/lotteryRunner');

const lotteryText = '可以在2026年6月28日 14:00 ~ 2026年7月6日 04:59消耗抽獎券參與抽獎';

test('parseLotteryWindowText reads the public lottery window from page text', () => {
    assert.deepEqual(parseLotteryWindowText(lotteryText), {
        startAt: '2026-06-28T14:00:00+08:00',
        endAt: '2026-07-06T04:59:00+08:00'
    });
});

test('getLotteryWindowStatus only allows draws during the published lottery window', () => {
    assert.equal(getLotteryWindowStatus({
        text: lotteryText,
        now: new Date('2026-06-28T13:59:59+08:00')
    }).isActive, false);

    assert.equal(getLotteryWindowStatus({
        text: lotteryText,
        now: new Date('2026-06-28T14:00:00+08:00')
    }).isActive, true);

    assert.equal(getLotteryWindowStatus({
        text: lotteryText,
        now: new Date('2026-07-06T04:59:01+08:00')
    }).isActive, false);
});

test('runUmamatchLottery skips drawing outside the published lottery window', async () => {
    const drawn = [];
    const result = await runUmamatchLottery({
        claim: true,
        lotteryWindowText: lotteryText,
        now: new Date('2026-06-28T13:59:59+08:00'),
        client: {
            async getLotteryTickets() {
                return 2;
            },
            async drawLottery() {
                drawn.push(true);
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(result.skipped, true);
    assert.equal(result.reason, 'lottery_window_inactive');
    assert.deepEqual(drawn, []);
});

test('runUmamatchLottery draws once per available ticket during the published lottery window', async () => {
    const drawResults = [
        { prizeId: 0, prizeName: '謝謝參與', isWin: false },
        { prizeId: 2, prizeName: '賽馬娘官方4週年壓克力立牌', isWin: true }
    ];
    const drawn = [];

    const result = await runUmamatchLottery({
        claim: true,
        lotteryWindowText: lotteryText,
        now: new Date('2026-06-28T14:00:00+08:00'),
        client: {
            async getLotteryTickets() {
                return drawResults.length;
            },
            async drawLottery() {
                const result = drawResults[drawn.length];
                drawn.push(result);
                return result;
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(result.skipped, false);
    assert.equal(result.ticketCount, 2);
    assert.deepEqual(result.drawResults, drawResults);
    assert.deepEqual(drawn, drawResults);
});

test('runUmamatchLottery reports tickets without drawing in dry-run mode', async () => {
    const result = await runUmamatchLottery({
        claim: false,
        lotteryWindowText: lotteryText,
        now: new Date('2026-06-28T14:00:00+08:00'),
        client: {
            async getLotteryTickets() {
                return { count: 3 };
            },
            async drawLottery() {
                throw new Error('dry-run should not draw');
            }
        },
        logger: { info() {}, warn() {} }
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.ticketCount, 3);
    assert.deepEqual(result.drawResults, []);
});
