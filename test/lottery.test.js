const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parsePoints,
    parsePrizeStock,
    getLotteryDecision,
    parseLotteryResult
} = require('../src/domain/lottery');

test('parsePoints treats expiring points as a subset of the current year balance', () => {
    const points = parsePoints({
        textItems: [
            '本年度積分：60',
            '即將過期積分：45'
        ],
        bodyText: ''
    });

    assert.equal(points.currentYear, 60);
    assert.equal(points.expiring, 45);
    assert.equal(points.total, 60);
});

test('parsePoints falls back to body text and preserves explicit total', () => {
    const points = parsePoints({
        textItems: ['總積分：120'],
        bodyText: '本年度積分 70\n即將過期積分 40'
    });

    assert.equal(points.currentYear, 70);
    assert.equal(points.expiring, 40);
    assert.equal(points.total, 120);
});

test('parsePrizeStock reads remaining counts and grand prize stock', () => {
    const stock = parsePrizeStock([
        { text: '豪華周邊 剩餘1份', contextText: '特等獎\n豪華周邊 剩餘1份' },
        { text: '小禮物 剩餘: 10', contextText: '普通獎\n小禮物 剩餘: 10' },
        { text: '貼紙 已抽完', contextText: '貼紙 已抽完' }
    ]);

    assert.equal(stock.prizes.length, 3);
    assert.equal(stock.hasAnyStock, true);
    assert.equal(stock.hasGrandPrizeStock, true);
    assert.equal(stock.grandPrize.name, '豪華周邊');
    assert.equal(stock.prizes[2].remaining, 0);
});

test('parsePrizeStock falls back to first prize as grand prize', () => {
    const stock = parsePrizeStock([
        { text: 'A賞 剩餘：0', contextText: 'A賞 剩餘：0' },
        { text: 'B賞 剩餘：5', contextText: 'B賞 剩餘：5' }
    ]);

    assert.equal(stock.grandPrize.name, 'A賞');
    assert.equal(stock.hasGrandPrizeStock, false);
});

test('getLotteryDecision requires at least 100 points and grand prize stock', () => {
    const stock = parsePrizeStock([
        { text: '特等獎品 剩餘1份', contextText: '特等獎\n特等獎品 剩餘1份' }
    ]);

    assert.deepEqual(
        getLotteryDecision({ total: 99 }, stock),
        { shouldDraw: false, reason: 'Points insufficient (99/100)' }
    );

    assert.deepEqual(
        getLotteryDecision({ total: 100 }, stock),
        { shouldDraw: true, reason: 'Grand prize stock available' }
    );
});

test('getLotteryDecision skips when grand prize is sold out', () => {
    const stock = parsePrizeStock([
        { text: '特等獎品 已抽完', contextText: '特等獎\n特等獎品 已抽完' }
    ]);

    assert.deepEqual(
        getLotteryDecision({ total: 120 }, stock),
        { shouldDraw: false, reason: 'Grand prize stock unavailable (0 remaining)' }
    );
});

test('parseLotteryResult reads no-win and winning text', () => {
    assert.equal(parseLotteryResult('提示：本次未中獎，請再接再厲。'), '本次未中獎，請再接再厲。');
    assert.equal(parseLotteryResult('恭喜您獲得【SSR券】'), '恭喜您獲得【SSR券】');
    assert.equal(parseLotteryResult('簽到成功 獲得【每日獎勵】'), null);
});
