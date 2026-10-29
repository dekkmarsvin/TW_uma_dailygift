const { STORY_TASKS, summarizeSnapshot } = require('./policy');

async function runIsland({ adapter, claim = false, logger = console, assertActive = () => {} }) {
    let snapshot = await adapter.load();
    const before = summarizeSnapshot(snapshot);
    const actions = [];
    if (!claim) return { dryRun: true, before, after: before, actions };

    for (const task of STORY_TASKS) {
        if (!snapshot.tasks.extra_tasks.some(t => String(t.task_id) === task.id && !t.finished)) continue;
        assertActive();
        snapshot = await adapter.browseStory(task.tab);
        if (!snapshot.tasks.extra_tasks.some(t => String(t.task_id) === task.id && t.finished)) {
            throw new Error(`Island browsing task ${task.id} was not verified; stopping.`);
        }
        actions.push({ type: 'browse', tab: task.tab });
    }

    // At most six construction requests and six claims. Claim pending nodes before
    // building again, including rewards left by a previous interrupted run.
    for (let round = 0; round < 12; round++) {
        const state = summarizeSnapshot(snapshot);
        if (state.pendingRewards.length) {
            assertActive();
            snapshot = await adapter.claimRewards();
            const next = summarizeSnapshot(snapshot);
            const claimed = state.pendingRewards.filter(stage => next.claimedRewards.includes(stage));
            if (!claimed.length) throw new Error('Island reward claim was not verified; stopping.');
            actions.push({ type: 'claim', stages: claimed });
            continue;
        }
        if (!state.canBuild) break;
        assertActive();
        snapshot = await adapter.build();
        const next = summarizeSnapshot(snapshot);
        if (next.built !== state.built + 1 || next.tools > state.tools - 10) {
            throw new Error('Island building progress was not verified; stopping before another build.');
        }
        actions.push({ type: 'build', stage: next.built });
    }

    for (let round = 0; round < 6; round++) {
        const state = summarizeSnapshot(snapshot);
        if (!state.remaining) break;
        assertActive();
        const result = await adapter.draw();
        snapshot = result.snapshot;
        if (summarizeSnapshot(snapshot).remaining !== state.remaining - 1) {
            throw new Error('Island draw chance consumption was not verified; check My Rewards before retrying.');
        }
        actions.push({ type: 'draw', prize: result.prize });
        if (result.prize.physical) logger.warn('Island physical prize won: fill in the delivery information manually before 2026-11-23 04:59 (UTC+8).');
    }
    return { dryRun: false, before, after: summarizeSnapshot(snapshot), actions };
}

module.exports = { runIsland };
