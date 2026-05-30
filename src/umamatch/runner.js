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
            shareCompletion = {
                attempted: true,
                ...(await completeDailyShareTask(shareTask))
            };
            if (typeof client.reportShare === 'function') {
                shareCompletion.reportShare = await client.reportShare(shareTask.taskId);
            }
            sections = await readTaskSections(client);
        } else {
            logger.warn('Daily share task is unfinished, but no completer was provided.');
        }
    }

    const summary = summarizeTaskSections(sections);
    const claimable = collectClaimableTasks(sections);

    logger.info(`UMA Match tasks: ${claimable.length} claimable reward(s).`);

    const claimResults = [];
    if (claim) {
        for (const task of claimable) {
            logger.info(`Claiming ${task.category} reward: ${task.title} (${task.taskId})`);
            const result = await client.claimReward(task.taskId);
            claimResults.push({ taskId: task.taskId, ...result });
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
        shareCompletion
    };
}

module.exports = {
    findUnfinishedDailyShareTask,
    runUmamatchTasks
};
