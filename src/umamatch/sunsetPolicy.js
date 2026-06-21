const DEFAULT_UMAMATCH_SUNSET_AT = '2026-07-06T04:59:00+08:00';
const DEFAULT_UMAMATCH_TASK_SUNSET_AT = '2026-06-29T04:59:00+08:00';

function parseSunsetAt(value, envName) {
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        throw new Error(`Invalid ${envName}: ${value}`);
    }
    return timestamp;
}

function getSunsetStatus({ sunsetAt, envName, now }) {
    const sunsetTime = parseSunsetAt(sunsetAt, envName);
    const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();

    if (Number.isNaN(nowTime)) {
        throw new Error(`Invalid current time for UMA Match sunset check: ${now}`);
    }

    return {
        isSunset: nowTime >= sunsetTime,
        sunsetAt,
        now: now instanceof Date ? now.toISOString() : new Date(now).toISOString()
    };
}

function getUmamatchSunsetStatus({ env = process.env, now = new Date() } = {}) {
    return getSunsetStatus({
        sunsetAt: env.UMAMATCH_SUNSET_AT || DEFAULT_UMAMATCH_SUNSET_AT,
        envName: 'UMAMATCH_SUNSET_AT',
        now
    });
}

function getUmamatchTaskSunsetStatus({ env = process.env, now = new Date() } = {}) {
    return getSunsetStatus({
        sunsetAt: env.UMAMATCH_TASK_SUNSET_AT || DEFAULT_UMAMATCH_TASK_SUNSET_AT,
        envName: 'UMAMATCH_TASK_SUNSET_AT',
        now
    });
}

module.exports = {
    DEFAULT_UMAMATCH_SUNSET_AT,
    DEFAULT_UMAMATCH_TASK_SUNSET_AT,
    getUmamatchSunsetStatus,
    getUmamatchTaskSunsetStatus
};
