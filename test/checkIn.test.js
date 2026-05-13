const test = require('node:test');
const assert = require('node:assert/strict');

const { readCheckInStatus } = require('../src/domain/checkIn');

test('readCheckInStatus reports disabled visible sign button as already checked in', () => {
    const status = readCheckInStatus({
        bodyText: '本月已累計簽到 4 天',
        signButtons: [
            {
                visible: true,
                filter: 'grayscale(1)',
                pointerEvents: 'none',
                opacity: '1',
                disabled: false,
                classList: []
            }
        ]
    });

    assert.equal(status.daysChecked, 4);
    assert.equal(status.hasCheckInButton, true);
    assert.equal(status.buttonState.isDisabledByStyle, true);
});

test('readCheckInStatus reports active visible sign button as available', () => {
    const status = readCheckInStatus({
        bodyText: '本月已累計簽到 3 天',
        signButtons: [
            {
                visible: true,
                filter: 'none',
                pointerEvents: 'auto',
                opacity: '1',
                disabled: false,
                classList: []
            }
        ]
    });

    assert.equal(status.daysChecked, 3);
    assert.equal(status.hasCheckInButton, true);
    assert.equal(status.buttonState.isDisabledByStyle, false);
});
