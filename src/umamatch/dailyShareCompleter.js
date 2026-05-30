function taskUrl(eventUrl, path) {
    return `${eventUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

async function clickDailyShareGoComplete(page) {
    return page.evaluate(() => {
        const isVisible = el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0';
        };

        const taskText = '每日分享1次拼圖交換';
        const title = Array.from(document.querySelectorAll('body *'))
            .filter(isVisible)
            .find(el => String(el.innerText || el.textContent || '').includes(taskText));

        if (!title) return false;

        let container = title;
        for (let i = 0; i < 8 && container; i++) {
            const buttons = Array.from(container.querySelectorAll('.btn_task, button, [role="button"], a'))
                .filter(isVisible);
            const target = buttons.find(el => !String(el.className || '').includes('rewarded'));
            if (target) {
                target.click();
                return true;
            }
            container = container.parentElement;
        }

        return false;
    });
}

async function clickAnyShareAction(page) {
    return page.evaluate(() => {
        const labels = ['贈送', '徵求', '交換'];
        const isVisible = el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0';
        };

        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], div, span'))
            .filter(isVisible);

        for (const label of labels) {
            const target = candidates.find(el => {
                const text = String(
                    el.innerText ||
                    el.textContent ||
                    el.getAttribute('alt') ||
                    el.getAttribute('title') ||
                    ''
                ).trim();
                return text === label || text.includes(label);
            });

            if (target) {
                target.click();
                return { clicked: true, label };
            }
        }

        return { clicked: false, label: null };
    });
}

async function completeDailyShareTask({ page, eventUrl, logger = console }) {
    await page.goto(taskUrl(eventUrl, 'task/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const clickedGoComplete = await clickDailyShareGoComplete(page);
    if (!clickedGoComplete) {
        logger.warn('Daily share go-complete button was not found; opening task detail page directly.');
        await page.goto(taskUrl(eventUrl, 'task-detail/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    await page.waitForTimeout(2000);
    const action = await clickAnyShareAction(page);
    if (!action.clicked) {
        throw new Error('No daily share action button found (贈送/徵求/交換)');
    }

    await page.waitForTimeout(2000);
    logger.info(`Daily share task action clicked: ${action.label}`);
    return { completed: true, actionLabel: action.label };
}

module.exports = {
    completeDailyShareTask
};
