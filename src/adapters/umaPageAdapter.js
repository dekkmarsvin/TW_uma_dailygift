const { readCheckInStatus, parseCheckInDays } = require('../domain/checkIn');
const {
    parsePoints,
    parsePrizeStock,
    parseLotteryResult
} = require('../domain/lottery');

class UmaPageAdapter {
    constructor(page, logger = console) {
        this.page = page;
        this.logger = logger;
    }

    async readLoginState() {
        return this.page.evaluate(() => {
            const header = document.querySelector('.top-b1');
            const headerText = header ? header.innerText.trim() : '';
            return {
                headerText,
                loggedOut: headerText.includes('登入')
            };
        });
    }

    async readCheckInStatus() {
        const snapshot = await this.page.evaluate(() => {
            const signButtons = Array.from(document.querySelectorAll('.sign-btn')).map(btn => {
                const computedStyle = window.getComputedStyle(btn);
                return {
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    filter: computedStyle.filter || '',
                    pointerEvents: computedStyle.pointerEvents || '',
                    opacity: computedStyle.opacity || '1',
                    disabled: btn.disabled || btn.hasAttribute('disabled'),
                    classList: Array.from(btn.classList)
                };
            });

            return {
                bodyText: document.body.innerText,
                signButtons
            };
        });

        return readCheckInStatus(snapshot);
    }

    async clickCheckInButton() {
        return this.page.evaluate(() => {
            const btns = document.querySelectorAll('.sign-btn');
            for (const btn of btns) {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });
    }

    async readCheckInDays() {
        const bodyText = await this.page.evaluate(() => document.body.innerText);
        return parseCheckInDays(bodyText);
    }

    async closeRewardPopupIfVisible() {
        const clickedClose = await this.page.evaluate(() => {
            const isVisible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0';
            };

            const dialogs = Array.from(document.querySelectorAll('div, section, article'))
                .filter(el => {
                    if (!isVisible(el)) return false;
                    const rect = el.getBoundingClientRect();
                    const text = el.innerText || '';
                    return /簽到成功|恭喜獲得/.test(text) &&
                        rect.width >= 250 &&
                        rect.width <= Math.min(window.innerWidth * 0.9, 900) &&
                        rect.height >= 120 &&
                        rect.height <= Math.min(window.innerHeight * 0.8, 700);
                })
                .sort((a, b) => {
                    const ar = a.getBoundingClientRect();
                    const br = b.getBoundingClientRect();
                    return (ar.width * ar.height) - (br.width * br.height);
                });

            const dialog = dialogs[0];
            if (!dialog) {
                return false;
            }

            const closeCandidates = Array.from(dialog.querySelectorAll(
                '[class*="close"], [aria-label*="close"], [aria-label*="關閉"], button, img, div, span'
            ));

            for (const el of closeCandidates) {
                if (!isVisible(el)) continue;

                const text = (el.innerText || el.textContent || el.getAttribute('alt') || el.getAttribute('title') || '').trim();
                const className = typeof el.className === 'string' ? el.className : '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                const looksLikeClose = className.toLowerCase().includes('close') ||
                    ariaLabel.toLowerCase().includes('close') ||
                    ariaLabel.includes('關閉') ||
                    ['×', 'x', 'X', '✕', '關閉'].includes(text);

                if (looksLikeClose) {
                    el.click();
                    return true;
                }
            }

            return false;
        });

        if (clickedClose) {
            await this.page.waitForTimeout(800);
            return true;
        }

        const closePoint = await this.page.evaluate(() => {
            const isVisible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 200 &&
                    rect.height > 100 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0';
            };

            const dialogs = Array.from(document.querySelectorAll('div, section, article'))
                .filter(el => {
                    if (!isVisible(el)) return false;
                    const rect = el.getBoundingClientRect();
                    return /簽到成功|恭喜獲得/.test(el.innerText || '') &&
                        rect.width >= 250 &&
                        rect.width <= Math.min(window.innerWidth * 0.9, 900) &&
                        rect.height >= 120 &&
                        rect.height <= Math.min(window.innerHeight * 0.8, 700);
                })
                .map(el => {
                    const rect = el.getBoundingClientRect();
                    return {
                        x: Math.max(rect.left + 10, rect.right - 40),
                        y: Math.max(rect.top + 10, rect.top + 36),
                        area: rect.width * rect.height
                    };
                })
                .sort((a, b) => a.area - b.area);

            return dialogs[0] || null;
        });

        if (closePoint) {
            await this.page.mouse.click(closePoint.x, closePoint.y);
            await this.page.waitForTimeout(800);
            return true;
        }

        return false;
    }

    async readPoints() {
        const snapshot = await this.page.evaluate(() => {
            const textItems = [];
            const allElements = document.querySelectorAll('div, span, p, label, li, b, strong');

            for (const el of allElements) {
                if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;

                const clone = el.cloneNode(true);
                Array.from(clone.children).forEach(child => child.remove());
                const text = clone.innerText ? clone.innerText.trim() : '';

                if (text) {
                    textItems.push(text);
                }
            }

            return {
                bodyText: document.body.innerText,
                textItems
            };
        });

        return parsePoints(snapshot);
    }

    async readPrizeStock() {
        const items = await this.page.evaluate(() => {
            const stockElements = document.querySelectorAll('.points-show-box-name');
            return Array.from(stockElements).map(el => ({
                text: el.innerText || el.textContent || '',
                contextText: [
                    el.parentElement?.innerText || '',
                    el.parentElement?.parentElement?.innerText || ''
                ].join('\n')
            }));
        });

        return parsePrizeStock(items);
    }

    async readLotteryButtonInfo() {
        return this.page.evaluate(() => {
            const buttons = document.querySelectorAll('.points-draw');
            const buttonData = [];

            buttons.forEach((btn, index) => {
                buttonData.push({
                    index,
                    visible: btn.offsetWidth > 0 && btn.offsetHeight > 0,
                    tag: btn.tagName,
                    className: btn.className,
                    text: btn.innerText || btn.textContent || '(no text)'
                });
            });

            return {
                count: buttons.length,
                buttons: buttonData
            };
        });
    }

    async clickLotteryButton() {
        const lotterySelectors = [
            '#uma > div.points > div > div.points-main > div.points-main-left > div.points-draw > img.bg',
            '#uma > div.points > div > div.points-main > div.points-main-left > div.points-draw',
            '.points-draw > img.bg',
            '.points-draw'
        ];

        for (const selector of lotterySelectors) {
            try {
                const target = this.page.locator(selector).first();
                if (await target.isVisible({ timeout: 1500 })) {
                    await target.scrollIntoViewIfNeeded({ timeout: 5000 });
                    await this.page.waitForTimeout(300);
                    await target.click({ timeout: 5000 });
                    return { clicked: true, targetSelector: selector };
                }
            } catch (error) {
                this.logger.warn(`Lottery click target failed (${selector}): ${error.message}`);
            }
        }

        return { clicked: false, targetSelector: null };
    }

    async confirmLotteryPromptIfVisible() {
        try {
            const confirmImage = this.page.locator('.popup-fixed img.btns1').first();
            if (await confirmImage.isVisible({ timeout: 15000 })) {
                await confirmImage.click({ timeout: 5000 });
                await this.page.waitForTimeout(1000);
                return true;
            }
        } catch (error) {
            this.logger.warn('Lottery confirmation image click failed: ' + error.message);
        }

        const clickedConfirm = await this.page.evaluate(() => {
            const isVisible = (el) => {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return rect.width > 0 &&
                    rect.height > 0 &&
                    style.visibility !== 'hidden' &&
                    style.display !== 'none' &&
                    style.opacity !== '0';
            };

            const dialogs = Array.from(document.querySelectorAll('div, section, article'))
                .filter(el => {
                    if (!isVisible(el)) return false;
                    const text = el.innerText || '';
                    const rect = el.getBoundingClientRect();
                    return /繼續參與抽獎|確認|取消/.test(text) &&
                        rect.width >= 250 &&
                        rect.width <= Math.min(window.innerWidth * 0.9, 900) &&
                        rect.height >= 120 &&
                        rect.height <= Math.min(window.innerHeight * 0.8, 700);
                })
                .sort((a, b) => {
                    const ar = a.getBoundingClientRect();
                    const br = b.getBoundingClientRect();
                    return (ar.width * ar.height) - (br.width * br.height);
                });

            const dialog = dialogs[0];
            if (!dialog) return false;

            const candidates = Array.from(dialog.querySelectorAll('button, div, span, a, img'));
            for (const el of candidates) {
                if (!isVisible(el)) continue;
                const text = (
                    el.innerText ||
                    el.textContent ||
                    el.getAttribute('alt') ||
                    el.getAttribute('title') ||
                    ''
                ).trim();
                const className = typeof el.className === 'string' ? el.className : '';
                if ((text.includes('確認') || className.includes('confirm')) && !text.includes('取消')) {
                    el.click();
                    return true;
                }
            }

            return false;
        });

        if (clickedConfirm) {
            await this.page.waitForTimeout(1000);
            return true;
        }

        // 沒有找到明確的確認控制項時不做任何點擊。
        // 這條路徑會消耗積分，盲目點擊座標可能誤觸其他元素。
        this.logger.warn('Lottery confirmation control not found; skipping blind click.');
        return false;
    }

    async readLotteryResult() {
        const bodyText = await this.page.evaluate(() => {
            const marquee = document.querySelector('.points-left-title');
            if (marquee) marquee.style.display = 'none';

            const text = document.body.innerText;

            if (marquee) marquee.style.display = '';
            return text;
        });

        return parseLotteryResult(bodyText);
    }

    async readLotteryResultFromHistory() {
        try {
            const historyBtn = this.page.locator('.points-reward-log');
            if (await historyBtn.isVisible({ timeout: 2000 })) {
                await historyBtn.click();
                await this.page.waitForTimeout(1000);
                const bodyText = await this.page.evaluate(() => document.body.innerText);
                const historyMatch = bodyText.match(/抽中了【(.+?)】/);
                return historyMatch ? historyMatch[0] : null;
            }
        } catch (error) {
            return null;
        }

        return null;
    }
}

module.exports = UmaPageAdapter;
