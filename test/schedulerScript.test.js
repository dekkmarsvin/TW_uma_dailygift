const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '../run_automation.ps1'), 'utf8');

test('scheduler runs the daily gift automation and no longer spawns the sunset umamatch step', () => {
    assert.match(script, /Invoke-AutomationStep\s+-Name\s+"UMA Daily Gift"/);
    assert.match(script, /-ScriptPath\s+"src\/automation\.js"/);
    assert.doesNotMatch(script, /Invoke-AutomationStep\s+-Name\s+"UMA Match Tasks"/);
    assert.doesNotMatch(script, /-ScriptPath\s+"src\/umamatchAutomation\.js"/);
});

test('scheduler accumulates automation exit codes before deciding final failure', () => {
    assert.match(script, /\$FailedSteps\s*=\s*@\(\)/);
    assert.match(script, /\$FailedSteps\s*\+=\s*\$Result/);
    assert.match(script, /if\s*\(\$FailedSteps\.Count\s+-gt\s+0\)/);
    assert.doesNotMatch(script, /exit\s+\$AutomationExitCode/);
});

test('scheduler keeps child process output out of automation step result objects', () => {
    assert.match(script, /\$NodeOutput\s*=\s*&\s+node\s+\$ScriptPath\s+@Arguments\s+2>&1/);
    assert.match(script, /foreach\s*\(\$Line\s+in\s+\$NodeOutput\)/);
    assert.match(script, /\$Result\s*=\s*Invoke-AutomationStep\s+-Name\s+"UMA Daily Gift"/);
});

test('runner exposes a setup wizard for env and Windows Task Scheduler configuration', () => {
    assert.match(script, /param\s*\([\s\S]*\[switch\]\$Setup/);
    assert.match(script, /function\s+Show-SetupWizard/);
    assert.match(script, /function\s+Set-EnvFileFromUi/);
    assert.match(script, /function\s+Register-SchedulerTaskFromUi/);
    assert.match(script, /System\.Windows\.Forms/);
    assert.match(script, /Microsoft\.VisualBasic/);
    assert.match(script, /Register-ScheduledTask/);
    assert.match(script, /New-ScheduledTaskAction/);
    assert.match(script, /New-ScheduledTaskTrigger/);
    assert.match(script, /New-ScheduledTaskSettingsSet/);
});

test('runner automatically launches env setup when required configuration is missing', () => {
    assert.match(script, /\$RequiredConfigNames\s*=\s*@\("login_username",\s*"login_password",\s*"GEMINI_API_KEY"\)/);
    assert.match(script, /function\s+Get-EffectiveConfigValue/);
    assert.match(script, /function\s+Get-MissingRequiredConfigNames/);
    assert.match(script, /function\s+Ensure-RequiredConfiguration/);
    assert.match(script, /Set-EnvFileFromUi/);
    assert.match(script, /Run \.\\run_automation\.ps1 -ConfigureEnv/);
    assert.match(script, /Ensure-RequiredConfiguration\s*\r?\n\s*Ensure-NodeDependencies/);
});

test('scheduler shows its error dialog in a separate process so the task cannot hang', () => {
    assert.ok(script.includes("Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-EncodedCommand', $EncodedNotify"));
    assert.ok(script.includes('[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($NotifyScript))'));
    assert.ok(!script.includes('"自動化執行失敗: $_",'));
});
