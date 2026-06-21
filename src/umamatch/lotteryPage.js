async function readLotteryWindowText({ page, eventUrl, logger = console }) {
    const pointUrl = new URL('point/', eventUrl).toString();
    await page.goto(pointUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    const text = await page.evaluate(() => {
        const candidates = [
            document.querySelector('.lottery-head .desc'),
            document.querySelector('.lottery-head'),
            document.querySelector('.block2')
        ];

        for (const candidate of candidates) {
            const textContent = candidate && candidate.innerText && candidate.innerText.trim();
            if (textContent && textContent.includes('消耗抽獎券參與抽獎')) {
                return textContent;
            }
        }

        return document.body.innerText || '';
    });

    logger.info(`UMA Match lottery window text: ${text.replace(/\s+/g, ' ').trim()}`);
    return text;
}

module.exports = {
    readLotteryWindowText
};
