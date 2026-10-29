const EVENT_START = '2026-10-29T00:00:00+08:00';
const EVENT_END = '2026-11-16T04:59:00+08:00';
const STORY_TASKS = [
    { id: '418009', tab: 'PV' },
    { id: '418010', tab: '劇本角色' },
    { id: '418011', tab: '轉蛋情報' }
];

function getEventWindow(now = new Date(), end = EVENT_END) {
    const time = new Date(now).getTime();
    const endTime = new Date(end).getTime();
    if (!Number.isFinite(time) || !Number.isFinite(endTime) || endTime <= Date.parse(EVENT_START)) {
        throw new Error('Invalid island event time configuration');
    }
    return { active: time >= Date.parse(EVENT_START) && time < endTime, end };
}

function integer(value, name, max = Number.MAX_SAFE_INTEGER) {
    if (!Number.isSafeInteger(value) || value < 0 || value > max) {
        throw new Error(`Invalid island ${name}`);
    }
    return value;
}

function summarizeSnapshot({ status, tasks, draw }) {
    if (!status || status.build_max !== 6 || status.build_cost !== 10 || typeof status.can_build !== 'boolean') {
        throw new Error('Unrecognized island building rules');
    }
    if (!Array.isArray(status.nodes) || status.nodes.length !== 6) {
        throw new Error('Invalid island reward nodes');
    }
    const built = integer(status.built_count, 'built count', 6);
    const tools = integer(status.tool_count, 'tool count');
    const nodes = status.nodes.map(node => ({
        index: integer(node.node_index, 'node index', 6),
        state: integer(node.state, 'node state', 2)
    }));
    if (new Set(nodes.map(n => n.index)).size !== 6 || nodes.some(n => n.index < 1 || (n.index > built && n.state !== 0))) {
        throw new Error('Inconsistent island reward nodes');
    }
    const remaining = integer(draw?.chance_available, 'draw chances', 6);
    for (const section of ['daily_tasks', 'extra_tasks', 'return_tasks']) {
        if (!Array.isArray(tasks?.[section]) || tasks[section].some(t => !t.task_id || typeof t.finished !== 'boolean')) {
            throw new Error(`Invalid island ${section}`);
        }
    }
    return {
        tools,
        built,
        canBuild: status.can_build && tools >= 10 && built < 6,
        pendingRewards: nodes.filter(n => n.state === 1).map(n => n.index),
        claimedRewards: nodes.filter(n => n.state === 2).map(n => n.index),
        remaining,
        unfinishedTasks: [...tasks.daily_tasks, ...tasks.extra_tasks, ...tasks.return_tasks]
            .filter(t => !t.finished)
            .map(t => ({ id: String(t.task_id), title: t.task_name, progress: t.process, target: t.target }))
    };
}

function parseOptions(args) {
    if (args.length > 1 || args.some(arg => !['--claim', '--dry-run'].includes(arg))) {
        throw new Error('Use either --dry-run (default) or --claim');
    }
    return { claim: args[0] === '--claim' };
}

module.exports = { EVENT_START, EVENT_END, STORY_TASKS, getEventWindow, summarizeSnapshot, parseOptions };
