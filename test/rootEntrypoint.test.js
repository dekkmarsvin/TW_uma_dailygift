const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

test('project root keeps run_automation.ps1 as the only executable script entrypoint', () => {
    const executableExtensions = new Set(['.bat', '.cmd', '.js', '.ps1']);
    const rootScripts = fs.readdirSync(rootDir, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => executableExtensions.has(path.extname(name).toLowerCase()))
        .sort();

    assert.deepEqual(rootScripts, ['run_automation.ps1']);
});
