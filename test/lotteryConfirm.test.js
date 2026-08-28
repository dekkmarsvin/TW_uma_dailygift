const test = require('node:test');
const assert = require('node:assert/strict');

const UmaPageAdapter = require('../src/adapters/umaPageAdapter');

function createStubPage({ confirmImageVisible = false, domConfirmFound = false } = {}) {
    const calls = { mouseClicks: [], imageClicks: 0, waits: [] };

    return {
        calls,
        locator() {
            return {
                first() {
                    return {
                        async isVisible() {
                            return confirmImageVisible;
                        },
                        async click() {
                            calls.imageClicks += 1;
                        }
                    };
                }
            };
        },
        async evaluate() {
            return domConfirmFound;
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
    const page = createStubPage({ confirmImageVisible: false, domConfirmFound: false });
    const logger = createStubLogger();

    const confirmed = await new UmaPageAdapter(page, logger).confirmLotteryPromptIfVisible();

    assert.equal(confirmed, false, 'must not report a confirmation it did not make');
    assert.deepEqual(page.calls.mouseClicks, [], 'must not click arbitrary coordinates');
    assert.equal(page.calls.imageClicks, 0);
    assert.match(logger.messages.join('\n'), /skipping blind click/);
});

test('confirmLotteryPromptIfVisible uses the explicit confirm image when it is present', async () => {
    const page = createStubPage({ confirmImageVisible: true });
    const confirmed = await new UmaPageAdapter(page, createStubLogger()).confirmLotteryPromptIfVisible();

    assert.equal(confirmed, true);
    assert.equal(page.calls.imageClicks, 1);
    assert.deepEqual(page.calls.mouseClicks, []);
});

test('confirmLotteryPromptIfVisible accepts a confirm control found in the dialog DOM', async () => {
    const page = createStubPage({ confirmImageVisible: false, domConfirmFound: true });
    const confirmed = await new UmaPageAdapter(page, createStubLogger()).confirmLotteryPromptIfVisible();

    assert.equal(confirmed, true);
    assert.deepEqual(page.calls.mouseClicks, [], 'DOM path clicks in-page, not via the mouse');
});
