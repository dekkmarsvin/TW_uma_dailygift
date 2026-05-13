const POINT_KEYWORDS = {
    current: ['本年度積分', '今年積分'],
    expiring: ['即將過期積分', '即將到期', '過期積分'],
    total: ['總積分', '剩餘積分']
};

function extractNumber(text) {
    const match = String(text || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function parsePoints(snapshot = {}) {
    const bodyText = snapshot.bodyText || '';
    const textItems = Array.isArray(snapshot.textItems) ? snapshot.textItems : [];

    let currentYear = null;
    let expiring = null;
    let total = null;
    const debugInfo = [];
    const rawMatches = {
        currentYear: 'NOT FOUND',
        expiring: 'NOT FOUND',
        total: 'NOT FOUND'
    };

    for (const item of textItems) {
        const text = String(item || '').trim();
        if (!text || text.length > 50) continue;

        if (text.includes('積分')) {
            debugInfo.push(`Found '積分': "${text}"`);
        }

        if (POINT_KEYWORDS.current.some(keyword => text.includes(keyword))) {
            const value = extractNumber(text);
            if (value !== null) {
                currentYear = value;
                rawMatches.currentYear = text;
            }
        }

        if (POINT_KEYWORDS.expiring.some(keyword => text.includes(keyword))) {
            const value = extractNumber(text);
            if (value !== null) {
                expiring = value;
                rawMatches.expiring = text;
            }
        }

        if (POINT_KEYWORDS.total.some(keyword => text.includes(keyword))) {
            const value = extractNumber(text);
            if (value !== null) {
                total = value;
                rawMatches.total = text;
            }
        }
    }

    if (currentYear === null) {
        const match = bodyText.match(/本年度積分[：:\s]*(\d+)/);
        if (match) {
            currentYear = parseInt(match[1], 10);
            rawMatches.currentYear = match[0];
        }
    }

    if (expiring === null) {
        const match = bodyText.match(/即將過期積分[：:\s]*(\d+)/);
        if (match) {
            expiring = parseInt(match[1], 10);
            rawMatches.expiring = match[0];
        }
    }

    if (total === null) {
        const match = bodyText.match(/(?:總積分|剩餘積分)[：:\s]*(\d+)/);
        if (match) {
            total = parseInt(match[1], 10);
            rawMatches.total = match[0];
        }
    }

    currentYear = currentYear !== null ? currentYear : 0;
    expiring = expiring !== null ? expiring : 0;
    total = total !== null ? total : currentYear + expiring;

    return {
        currentYear,
        expiring,
        total,
        debugInfo: debugInfo.slice(0, 15),
        rawMatches
    };
}

function parsePrizeStock(items = []) {
    const prizes = [];

    for (const item of items) {
        const text = String(item && item.text || '');
        const contextText = String(item && item.contextText || '');
        const isGrandPrize = contextText.includes('特等獎') || text.includes('特等獎');
        const stockMatch = text.match(/剩餘[：:]?\s*(\d+)/);

        if (stockMatch) {
            const remaining = parseInt(stockMatch[1], 10);
            prizes.push({
                name: text.split(/剩餘/)[0].trim(),
                remaining,
                hasStock: remaining > 0,
                isGrandPrize
            });
        } else if (text.includes('已抽完')) {
            prizes.push({
                name: text.split(/已抽完/)[0].trim(),
                remaining: 0,
                hasStock: false,
                isGrandPrize
            });
        }
    }

    let grandPrizeIndex = prizes.findIndex(prize => prize.isGrandPrize);
    if (grandPrizeIndex < 0 && prizes.length > 0) {
        grandPrizeIndex = 0;
    }

    prizes.forEach((prize, index) => {
        prize.isGrandPrize = index === grandPrizeIndex;
    });

    const hasAnyStock = prizes.some(prize => prize.hasStock);
    const grandPrize = prizes.find(prize => prize.isGrandPrize) || null;
    const hasGrandPrizeStock = !!grandPrize && grandPrize.hasStock;

    return { prizes, hasAnyStock, grandPrize, hasGrandPrizeStock };
}

function getLotteryDecision(pointsData, prizeStockInfo, options = {}) {
    const minPoints = options.minPoints || 100;
    const total = Number(pointsData && pointsData.total || 0);

    if (total < minPoints) {
        return {
            shouldDraw: false,
            reason: `Points insufficient (${total}/${minPoints})`
        };
    }

    const grandPrize = prizeStockInfo && prizeStockInfo.grandPrize;
    if (!grandPrize) {
        return {
            shouldDraw: false,
            reason: 'Grand prize information not found'
        };
    }

    if (!prizeStockInfo.hasGrandPrizeStock) {
        return {
            shouldDraw: false,
            reason: `Grand prize stock unavailable (${grandPrize.remaining} remaining)`
        };
    }

    return {
        shouldDraw: true,
        reason: 'Grand prize stock available'
    };
}

function parseLotteryResult(bodyText) {
    const text = String(bodyText || '');
    const noWinMatch = text.match(/本次未中獎[^。\n]*。?/);
    if (noWinMatch) {
        return noWinMatch[0];
    }

    const resultPatterns = [
        /抽獎成功.*?獲得.*?【(.+?)】/,
        /恭喜.*?獲得.*?【(.+?)】/,
        /抽中了【(.+?)】/,
        /獲得.*?【(.+?)】/
    ];

    for (const pattern of resultPatterns) {
        const match = text.match(pattern);
        if (!match) continue;

        const contextStart = Math.max(0, match.index - 20);
        const contextEnd = Math.min(text.length, match.index + match[0].length + 20);
        const localContext = text.slice(contextStart, contextEnd);

        if (!localContext.includes('簽到成功')) {
            return match[0];
        }
    }

    return null;
}

module.exports = {
    extractNumber,
    parsePoints,
    parsePrizeStock,
    getLotteryDecision,
    parseLotteryResult
};
