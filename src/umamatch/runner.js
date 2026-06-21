const {
    collectClaimableTasks,
    summarizeTaskSections
} = require('./taskPolicy');

function findUnfinishedDailyShareTask(dailyTasks = []) {
    return dailyTasks.find(task =>
        task &&
        task.isCompleted !== true &&
        task.isEnd !== true &&
        (
            task.taskId === 'uma-4-task3' ||
            String(task.title || '').includes('每日分享1次拼圖交換')
        )
    ) || null;
}

async function readTaskSections(client) {
    return {
        daily: await client.getDailyTasks(),
        milestones: await client.getMilestoneTasks(),
        oneTime: await client.getOneTimeTasks()
    };
}

async function runUmamatchTasks({ client, claim = false, completeDailyShareTask = null, logger = console }) {
    let sections = await readTaskSections(client);
    let shareCompletion = { attempted: false, completed: false };

    const shareTask = findUnfinishedDailyShareTask(sections.daily);
    if (claim && shareTask) {
        if (typeof completeDailyShareTask === 'function') {
            logger.info(`Completing daily share task before claiming rewards: ${shareTask.title}`);
            shareCompletion = { attempted: true, completed: false };
            try {
                shareCompletion = {
                    ...shareCompletion,
                    ...(await completeDailyShareTask(shareTask))
                };
            } catch (error) {
                shareCompletion.error = error.message;
                logger.warn(`Daily share UI completion failed: ${error.message}`);
            }
            if (typeof client.reportShare === 'function') {
                shareCompletion.reportShare = await client.reportShare(shareTask.taskId);
            }
            sections = await readTaskSections(client);
        } else {
            logger.warn('Daily share task is unfinished, but no completer was provided.');
        }
    }

    let summary = summarizeTaskSections(sections);
    let claimable = collectClaimableTasks(sections);

    logger.info(`UMA Match tasks: ${claimable.length} claimable reward(s).`);

    const claimResults = [];
    let claimRounds = 0;
    if (claim) {
        const claimedTaskIds = new Set();
        const maxClaimRounds = 5;

        while (claimable.length > 0 && claimRounds < maxClaimRounds) {
            claimRounds++;
            for (const task of claimable) {
                logger.info(`Claiming ${task.category} reward: ${task.title} (${task.taskId})`);
                const result = await client.claimReward(task.taskId);
                claimedTaskIds.add(task.taskId);
                claimResults.push({ taskId: task.taskId, ...result });
            }

            sections = await readTaskSections(client);
            summary = summarizeTaskSections(sections);
            claimable = collectClaimableTasks(sections)
                .filter(task => !claimedTaskIds.has(task.taskId));
        }

        if (claimable.length > 0) {
            logger.warn(`Stopped after ${maxClaimRounds} claim rounds with ${claimable.length} reward(s) still claimable.`);
        }
    } else if (claimable.length > 0) {
        logger.info('Dry-run mode: no rewards were claimed.');
    }

    return {
        dryRun: !claim,
        sections,
        summary,
        claimable,
        claimResults,
        claimRounds,
        shareCompletion
    };
}

module.exports = {
    findUnfinishedDailyShareTask,
    runUmamatchTasks
};
