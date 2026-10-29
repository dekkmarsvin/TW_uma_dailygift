const test = require('node:test');
const assert = require('node:assert/strict');
const { runIsland } = require('../src/island/runner');
const { getEventWindow, parseOptions } = require('../src/island/policy');

function snapshot({ tools = 60, built = 0, remaining = 0 } = {}) {
    return {
        status: {
            tool_count: tools, built_count: built, build_max: 6, build_cost: 10, can_build: tools >= 10 && built < 6,
            nodes: Array.from({ length: 6 }, (_, i) => ({ node_index: i + 1, state: i < built ? 1 : 0 }))
        },
        tasks: {
            daily_tasks: [{ task_id: '418003', task_name: 'Game cultivation', finished: false, process: 0, target: 1 }],
            extra_tasks: ['418009', '418010', '418011'].map(task_id => ({ task_id, finished: false })),
            return_tasks: []
        },
        draw: { chance_available: remaining }
    };
}

function adapterFor(initial) {
    let data = structuredClone(initial);
    const calls = [];
    const copy = () => structuredClone(data);
    return {
        calls,
        async load() { calls.push('load'); return copy(); },
        async browseStory(tab) {
            calls.push(tab);
            data.tasks.extra_tasks[['PV', '劇本角色', '轉蛋情報'].indexOf(tab)].finished = true;
            return copy();
        },
        async build() {
            calls.push('build');
            data.status.tool_count -= 10;
            data.status.built_count++;
            data.status.nodes[data.status.built_count - 1].state = 1;
            data.status.can_build = data.status.tool_count >= 10 && data.status.built_count < 6;
            return copy();
        },
        async claimRewards() {
            calls.push('claim');
            for (const node of data.status.nodes) {
                if (node.state === 1) {
                    node.state = 2;
                    if ([3, 6].includes(node.node_index)) data.draw.chance_available++;
                }
            }
            return copy();
        },
        async draw() {
            calls.push('draw');
            data.draw.chance_available--;
            return { prize: { id: 'coins', name: 'Coins', physical: false }, snapshot: copy() };
        }
    };
}

test('island event includes start and excludes exact cutoff; invalid override fails closed', () => {
    assert.equal(getEventWindow('2026-10-28T23:59:59+08:00').active, false);
    assert.equal(getEventWindow('2026-10-29T00:00:00+08:00').active, true);
    assert.equal(getEventWindow('2026-11-16T04:58:59+08:00').active, true);
    assert.equal(getEventWindow('2026-11-16T04:59:00+08:00').active, false);
    assert.throws(() => getEventWindow(new Date(), 'broken'), /Invalid island event/);
    assert.throws(() => parseOptions(['--claim', '--dry-run']), /Use either/);
    assert.equal(parseOptions([]).claim, false);
});

test('island dry-run reads existing progress without completing, claiming or drawing', async () => {
    const adapter = adapterFor(snapshot());
    const result = await runIsland({ adapter });
    assert.deepEqual(adapter.calls, ['load']);
    assert.deepEqual(result.before, result.after);
    assert.equal(result.dryRun, true);
});

test('island completes web tasks, builds six sites, claims rewards and uses two awarded chances', async () => {
    const adapter = adapterFor(snapshot());
    const result = await runIsland({ adapter, claim: true });
    assert.equal(result.after.built, 6);
    assert.equal(result.after.tools, 0);
    assert.deepEqual(result.after.claimedRewards, [1, 2, 3, 4, 5, 6]);
    assert.equal(result.actions.filter(a => a.type === 'draw').length, 2);
    assert.equal(result.after.remaining, 0);
    assert.deepEqual(result.after.unfinishedTasks.map(t => t.id), ['418003']);

    // A second run must not spend tools or draw chances again.
    const repeated = await runIsland({ adapter, claim: true });
    assert.deepEqual(repeated.actions, []);
});

test('island stops on unverified build progress without retrying or claiming', async () => {
    const data = snapshot();
    data.tasks.extra_tasks.forEach(t => { t.finished = true; });
    const adapter = adapterFor(data);
    adapter.build = async () => { adapter.calls.push('build'); return data; };
    await assert.rejects(runIsland({ adapter, claim: true }), /progress was not verified/);
    assert.deepEqual(adapter.calls, ['load', 'build']);
});
