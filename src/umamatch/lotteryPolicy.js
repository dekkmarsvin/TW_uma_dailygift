function pad(value) {
    return String(value).padStart(2, '0');
}

function toTaipeiIso({ year, month, day, hour, minute }) {
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+08:00`;
}

function parseLotteryWindowText(text) {
    const source = String(text || '').replace(/\s+/g, ' ');
    const match = source.match(
        /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2}):(\d{2})\s*[~～]\s*(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2}):(\d{2})/
    );

    if (!match) {
        throw new Error('UMA Match lottery window text not found');
    }

    const startYear = Number(match[1]);
    const endYear = Number(match[6] || match[1]);

    return {
        startAt: toTaipeiIso({
            year: startYear,
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5])
        }),
        endAt: toTaipeiIso({
            year: endYear,
            month: Number(match[7]),
            day: Number(match[8]),
            hour: Number(match[9]),
            minute: Number(match[10])
        })
    };
}

function getLotteryWindowStatus({ text, now = new Date() }) {
    const window = parseLotteryWindowText(text);
    const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const startTime = Date.parse(window.startAt);
    const endTime = Date.parse(window.endAt);

    if (Number.isNaN(nowTime)) {
        throw new Error(`Invalid current time for UMA Match lottery window check: ${now}`);
    }

    if (nowTime < startTime) {
        return {
            ...window,
            isActive: false,
            reason: 'lottery_window_not_started',
            now: now instanceof Date ? now.toISOString() : new Date(now).toISOString()
        };
    }

    if (nowTime > endTime) {
        return {
            ...window,
            isActive: false,
            reason: 'lottery_window_ended',
            now: now instanceof Date ? now.toISOString() : new Date(now).toISOString()
        };
    }

    return {
        ...window,
        isActive: true,
        reason: 'lottery_window_active',
        now: now instanceof Date ? now.toISOString() : new Date(now).toISOString()
    };
}

module.exports = {
    parseLotteryWindowText,
    getLotteryWindowStatus
};
