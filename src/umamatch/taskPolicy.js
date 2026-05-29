function isRewardTimeActive(task) {
    if (!Object.prototype.hasOwnProperty.call(task || {}, 'rewardTimeStatus')) {
        return true;
    }
    return Number(task.rewardTimeStatus) === 1;
}

function isClaimableTask(task = {}) {
    return !!task.taskId &&
        task.isCompleted === true &&
        task.isRewarded !== true &&
        task.isEnd !== true &&
        isRewardTimeActive(task);
}

function awardText(award = {}) {
    const parts = [];
    if (award.POINT) parts.push(`${award.POINT} points`);
    if (award.COUPON) parts.push(`${award.COUPON} coupons`);
    if (award.CARD_RANDOM) parts.push(`${award.CARD_RANDOM} random cards`);
    if (award.BDIP_GERM) parts.push(`${award.BDIP_GERM} jewels`);
    return parts.join(', ');
}

function normalizeTask(task, category) {
    const title = task.title || (
        category === 'milestone' && task.circleNum
            ? `第 ${task.circleNum} 週累計任務`
            : task.taskId
    );

    return {
        category,
        taskId: task.taskId,
        title,
        rewardName: task.rewardName || '',
        award: task.award || {},
        awardText: awardText(task.award || {}),
        raw: task
    };
}

function collectClaimableTasks(sections = {}) {
    const daily = Array.isArray(sections.daily) ? sections.daily : [];
    const milestones = Array.isArray(sections.milestones) ? sections.milestones : [];
    const oneTime = Array.isArray(sections.oneTime) ? sections.oneTime : [];

    return [
        ...daily.filter(isClaimableTask).map(task => normalizeTask(task, 'daily')),
        ...milestones.filter(isClaimableTask).map(task => normalizeTask(task, 'milestone')),
        ...oneTime.filter(isClaimableTask).map(task => normalizeTask(task, 'activity'))
    ];
}

function summarizeList(tasks = []) {
    return {
        total: tasks.length,
        completed: tasks.filter(task => task.isCompleted === true).length,
        rewarded: tasks.filter(task => task.isRewarded === true).length,
        claimable: tasks.filter(isClaimableTask).length
    };
}

function summarizeTaskSections(sections = {}) {
    return {
        daily: summarizeList(Array.isArray(sections.daily) ? sections.daily : []),
        milestones: summarizeList(Array.isArray(sections.milestones) ? sections.milestones : []),
        oneTime: summarizeList(Array.isArray(sections.oneTime) ? sections.oneTime : [])
    };
}

module.exports = {
    isClaimableTask,
    collectClaimableTasks,
    summarizeTaskSections
};
