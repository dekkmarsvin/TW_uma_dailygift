const { getLotteryWindowStatus } = require('./lotteryPolicy');

function getTicketCount(value) {
    if (typeof value === 'number') {
        return value;
    }
    if (value && typeof value.count === 'number') {
        return value.count;
    }
    if (value && typeof value.ticketCount === 'number') {
        return value.ticketCount;
    }
    if (value && typeof value.tickets === 'number') {
        return value.tickets;
    }
    return Number(value) || 0;
}

async function runUmamatchLottery({
    client,
    claim = false,
    lotteryWindowText,
    now = new Date(),
    maxDraws = 100,
    logger = console
}) {
    const windowStatus = getLotteryWindowStatus({ text: lotteryWindowText, now });
    if (!windowStatus.isActive) {
        logger.info(`UMA Match lottery skipped: ${windowStatus.reason} (${windowStatus.startAt} ~ ${windowStatus.endAt}).`);
        return {
            dryRun: !claim,
            skipped: true,
            reason: 'lottery_window_inactive',
            window: windowStatus,
            ticketCount: 0,
            drawResults: []
        };
    }

    const ticketCount = getTicketCount(await client.getLotteryTickets());
    logger.info(`UMA Match lottery tickets: ${ticketCount}.`);

    if (ticketCount <= 0) {
        logger.info('UMA Match lottery skipped: no lottery tickets available.');
        return {
            dryRun: !claim,
            skipped: true,
            reason: 'no_lottery_tickets',
            window: windowStatus,
            ticketCount,
            drawResults: []
        };
    }

    if (!claim) {
        logger.info('Dry-run mode: no UMA Match lottery draws were submitted.');
        return {
            dryRun: true,
            skipped: false,
            reason: 'dry_run',
            window: windowStatus,
            ticketCount,
            drawResults: []
        };
    }

    const drawLimit = Math.min(ticketCount, maxDraws);
    const drawResults = [];
    for (let index = 0; index < drawLimit; index++) {
        const result = await client.drawLottery();
        drawResults.push(result);
        const prizeName = result && result.prizeName ? result.prizeName : 'unknown prize';
        logger.info(`UMA Match lottery draw ${index + 1}/${drawLimit}: ${prizeName}`);
    }

    if (ticketCount > drawLimit) {
        logger.warn(`Stopped UMA Match lottery after ${drawLimit} draw(s); ${ticketCount - drawLimit} ticket(s) remain.`);
    }

    return {
        dryRun: false,
        skipped: false,
        reason: 'drawn',
        window: windowStatus,
        ticketCount,
        drawResults
    };
}

module.exports = {
    getTicketCount,
    runUmamatchLottery
};
