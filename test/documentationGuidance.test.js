const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('README installation guidance matches current repository and runtime requirements', () => {
    const readme = readProjectFile('README.md');
    const envExample = readProjectFile('.env.example');
    const packageJson = JSON.parse(readProjectFile('package.json'));

    assert.match(readme, /git clone https:\/\/github\.com\/dekkmarsvin\/TW_uma_dailygift\.git/);
    assert.match(readme, /\*\*Node\.js\*\* >= 20\.0\.0/);
    assert.match(readme, new RegExp(`model=${envExample.match(/^model=(.+)$/m)[1]}`));
    assert.equal(packageJson.engines.node, '>=20.0.0');
    assert.equal(packageJson.main, 'src/automation.js');
    assert.equal(packageJson.license, 'MIT');
});

test('documentation describes current umamatch and scheduler verification surface', () => {
    const readme = readProjectFile('README.md');
    const schedulerGuide = readProjectFile('SETUP_SCHEDULER.md');
    const testPlan = readProjectFile('docs/test_plan.md');

    assert.match(readme, /唯一入口.*run_automation\.ps1/);
    assert.match(readme, /run_automation\.ps1 -Setup/);
    assert.match(readme, /umamatch\/\s+# 4週年自訂配對大賽/);
    assert.match(testPlan, /test\/umamatchTasks\.test\.js/);
    assert.match(testPlan, /test\/schedulerScript\.test\.js/);
    assert.match(testPlan, /npm run umamatch:dry-run/);
    assert.match(schedulerGuide, /仍建議執行 `run_automation\.ps1`/);
    assert.doesNotMatch(schedulerGuide, /程式: C:\\Program Files\\nodejs\\node\.exe[\s\S]*src\\automation\.js/);
});

test('GitHub Actions runs the same automated test command documented for maintainers', () => {
    const workflow = readProjectFile('.github/workflows/ci.yml');

    assert.match(workflow, /node-version:\s*20\.x/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /npm test/);
});
