const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '../run_automation.ps1'), 'utf8');

test('scheduler runs dailygift and umamatch as separate automation steps', () => {
    assert.match(script, /Invoke-AutomationStep\s+-Name\s+"UMA Daily Gift"/);
    assert.match(script, /Invoke-AutomationStep\s+-Name\s+"UMA Match Tasks"/);
    assert.match(script, /-ScriptPath\s+"src\/automation\.js"/);
    assert.match(script, /-ScriptPath\s+"src\/umamatchAutomation\.js"\s+-Arguments\s+@\("--claim"\)/);
});

test('scheduler records both automation exit codes before deciding final failure', () => {
    assert.match(script, /\$FailedSteps\s*=\s*@\(\)/);
    assert.match(script, /\$FailedSteps\s*\+=\s*\$Result/);
    assert.match(script, /if\s*\(\$FailedSteps\.Count\s+-gt\s+0\)/);
    assert.doesNotMatch(script, /exit\s+\$AutomationExitCode/);
});
