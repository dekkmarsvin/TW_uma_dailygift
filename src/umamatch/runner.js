const {
    collectClaimableTasks,
    summarizeTaskSections
} = require('./taskPolicy');

async function runUmamatchTasks({ client, claim = false, logger = console }) {
    const sections = {
        daily: await client.getDailyTasks(),
        milestones: await client.getMilestoneTasks(),
        oneTime: await client.getOneTimeTasks()
    };

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
        claimResults
    };
}

module.exports = {
    runUmamatchTasks
};
