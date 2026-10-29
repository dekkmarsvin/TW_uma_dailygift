const test = require('node:test');
const assert = require('node:assert/strict');

const UmaPageAdapter = require('../src/adapters/umaPageAdapter');

function createStubPage({
    confirmImageVisible = false,
    domDialogFound = false,
    domConfirmFound = false
} = {}) {
    const calls = { mouseClicks: [], imageClicks: 0, waits: [] };

    return {
        calls,
        locator() {
            return {
                first() {
                    return {
                        async waitFor() {
                            if (confirmImageVisible) return;
                            const error = new Error('Timeout 5000ms exceeded.');
                            error.name = 'TimeoutError';
                            throw error;
                        },
                        async click() {
                            calls.imageClicks += 1;
                        }
                    };
                }
            };
        },
        async evaluate() {
            return {
                dialogFound: domDialogFound || domConfirmFound,
                confirmed: domConfirmFound
            };
        },
        async waitForTimeout(ms) {
            calls.waits.push(ms);
        },
        mouse: {
            async click(x, y) {
                calls.mouseClicks.push({ x, y });
            }
        },
        viewportSize() {
            return { width: 1280, height: 720 };
        }
    };
}

function createStubLogger() {
    const messages = [];
    return {
        messages,
        info: message => messages.push(`info: ${message}`),
        warn: message => messages.push(`warn: ${message}`),
        error: message => messages.push(`error: ${message}`)
    };
}

test('confirmLotteryPromptIfVisible never falls back to a blind coordinate click', async () => {
    const page = createStubPage({ confirmImageVisible: false, domDialogFound: true });
    const logger = createStubLogger();

    const result = await new UmaPageAdapter(page, logger).confirmLotteryPromptIfVisible();

    assert.equal(result.confirmed, false, 'must not report a confirmation it did not make');
    assert.equal(result.promptDetected, true, 'a visible dialog must be reported as detected');
    assert.deepEqual(page.calls.mouseClicks, [], 'must not click arbitrary coordinates');
    assert.equal(page.calls.imageClicks, 0);
    assert.match(logger.messages.join('\n'), /skipping blind click/);
});

test('confirmLotteryPromptIfVisible stays quiet when no confirmation prompt appears', async () => {
    const page = createStubPage({ confirmImageVisible: false, domDialogFound: false });
    const logger = createStubLogger();

    const result = await new UmaPageAdapter(page, logger).confirmLotteryPromptIfVisible();

    assert.equal(result.confirmed, false);
    assert.equal(result.promptDetected, false, 'a one-click draw has no prompt to detect');
    assert.equal(page.calls.imageClicks, 0);
    assert.deepEqual(logger.messages, [], 'a missing prompt is normal and must not warn');
});

test('confirmLotteryPromptIfVisible uses the explicit confirm image when it is present', async () => {
    const page = createStubPage({ confirmImageVisible: true });
    const result = await new UmaPageAdapter(page, createStubLogger()).confirmLotteryPromptIfVisible();

    assert.deepEqual(result, { confirmed: true, promptDetected: true });
    assert.equal(page.calls.imageClicks, 1);
    assert.deepEqual(page.calls.mouseClicks, []);
});

test('confirmLotteryPromptIfVisible accepts a confirm control found in the dialog DOM', async () => {
    const page = createStubPage({ confirmImageVisible: false, domConfirmFound: true });
    const result = await new UmaPageAdapter(page, createStubLogger()).confirmLotteryPromptIfVisible();

    assert.deepEqual(result, { confirmed: true, promptDetected: true });
    assert.deepEqual(page.calls.mouseClicks, [], 'DOM path clicks in-page, not via the mouse');
});
