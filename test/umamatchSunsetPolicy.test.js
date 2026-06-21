const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_UMAMATCH_SUNSET_AT,
    DEFAULT_UMAMATCH_TASK_SUNSET_AT,
    getUmamatchSunsetStatus,
    getUmamatchTaskSunsetStatus
} = require('../src/umamatch/sunsetPolicy');

test('getUmamatchSunsetStatus keeps umamatch active through the lottery period', () => {
    const status = getUmamatchSunsetStatus({
        now: new Date('2026-06-29T05:00:00+08:00')
    });

    assert.equal(status.sunsetAt, DEFAULT_UMAMATCH_SUNSET_AT);
    assert.equal(status.isSunset, false);
});

test('getUmamatchSunsetStatus sunsets all umamatch work after lottery close', () => {
    const status = getUmamatchSunsetStatus({
        now: new Date('2026-07-06T04:59:00+08:00')
    });

    assert.equal(status.sunsetAt, DEFAULT_UMAMATCH_SUNSET_AT);
    assert.equal(status.isSunset, true);
});

test('getUmamatchTaskSunsetStatus sunsets task claims before lottery closes', () => {
    const status = getUmamatchTaskSunsetStatus({
        now: new Date('2026-06-29T04:59:00+08:00')
    });

    assert.equal(status.sunsetAt, DEFAULT_UMAMATCH_TASK_SUNSET_AT);
    assert.equal(status.isSunset, true);
});

test('getUmamatchSunsetStatus accepts an environment override', () => {
    const status = getUmamatchSunsetStatus({
        env: { UMAMATCH_SUNSET_AT: '2026-07-13T04:59:00+08:00' },
        now: new Date('2026-07-06T05:00:00+08:00')
    });

    assert.equal(status.sunsetAt, '2026-07-13T04:59:00+08:00');
    assert.equal(status.isSunset, false);
});

test('getUmamatchTaskSunsetStatus accepts a task-specific environment override', () => {
    const status = getUmamatchTaskSunsetStatus({
        env: { UMAMATCH_TASK_SUNSET_AT: '2026-07-01T04:59:00+08:00' },
        now: new Date('2026-06-29T05:00:00+08:00')
    });

    assert.equal(status.sunsetAt, '2026-07-01T04:59:00+08:00');
    assert.equal(status.isSunset, false);
});

test('getUmamatchSunsetStatus rejects invalid sunset overrides', () => {
    assert.throws(
        () => getUmamatchSunsetStatus({ env: { UMAMATCH_SUNSET_AT: 'not-a-date' } }),
        /Invalid UMAMATCH_SUNSET_AT/
    );
});
