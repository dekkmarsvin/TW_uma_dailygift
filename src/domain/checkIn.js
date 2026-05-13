function parseCheckInDays(bodyText) {
    const match = String(bodyText || '').match(/本月已累計簽到\s*(\d+)\s*天/);
    return match ? parseInt(match[1], 10) : null;
}

function readCheckInStatus(snapshot = {}) {
    const bodyText = snapshot.bodyText || '';
    const signButtons = Array.isArray(snapshot.signButtons) ? snapshot.signButtons : [];
    const alreadyCheckedIn = bodyText.includes('已簽到') || bodyText.includes('已累計簽到');
    const daysChecked = parseCheckInDays(bodyText);
    const visibleButton = signButtons.find(button => button.visible) || null;
    let buttonState = null;

    if (visibleButton) {
        const filter = visibleButton.filter || '';
        const pointerEvents = visibleButton.pointerEvents || '';
        const opacity = visibleButton.opacity || '1';
        const classList = Array.isArray(visibleButton.classList)
            ? visibleButton.classList
            : String(visibleButton.classList || '').split(/\s+/).filter(Boolean);
        const disabled = !!visibleButton.disabled;
        const isGrayscale = filter.includes('grayscale') && filter.includes('1');
        const isNotClickable = pointerEvents === 'none';
        const isLowOpacity = parseFloat(opacity) < 0.5;
        const hasDisabledClass = classList.some(className =>
            className.includes('disabled') || className === 'dis' || className.includes('inactive')
        );

        buttonState = {
            filter,
            pointerEvents,
            opacity,
            disabled,
            classList: classList.join(' '),
            isGrayscale,
            isNotClickable,
            isLowOpacity,
            hasDisabledClass,
            isDisabledByStyle: isGrayscale || isNotClickable || isLowOpacity || disabled || hasDisabledClass
        };
    }

    return {
        alreadyCheckedIn,
        daysChecked,
        hasCheckInButton: !!visibleButton,
        buttonState
    };
}

module.exports = {
    parseCheckInDays,
    readCheckInStatus
};
