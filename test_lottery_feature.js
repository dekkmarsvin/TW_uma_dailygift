const { chromium } = require('playwright');
const config = require('./src/config');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies.json');

async function waitForPageReady(page) {
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    try {
        await page.waitForSelector('.top-b1, .points-draw, .sign-btn', { timeout: 15000 });
    } catch (error) {
        console.warn('⚠️ Main page markers not found within 15 seconds. Continuing with DOM inspection.');
    }

    await page.waitForTimeout(3000);
}

async function testLotteryFeature() {
    console.log('='.repeat(80));
    console.log('🎰 TESTING LOTTERY FEATURE');
    console.log('='.repeat(80));

    const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // Load cookies
        if (fs.existsSync(COOKIE_PATH)) {
            const cookiesString = fs.readFileSync(COOKIE_PATH, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await context.addCookies(cookies);
            console.log('✅ Loaded cookies\n');
        }

        console.log('📍 Navigating to website...');
        await waitForPageReady(page);

        console.log('\n🔍 Analyzing lottery page elements:\n');

        const loginInfo = await page.evaluate(() => {
            const header = document.querySelector('.top-b1');
            const headerText = header ? header.innerText.trim() : '';
            return {
                headerText,
                loggedOut: headerText.includes('登入')
            };
        });

        console.log('🔐 Login State:');
        console.log(`  Header: "${loginInfo.headerText || '(empty)'}"`);
        console.log(`  Logged Out: ${loginInfo.loggedOut ? '⚠️ YES' : '✅ NO'}\n`);

        // Test points extraction
        const pointsData = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            console.log('Page text sample:', bodyText.substring(0, 500));

            const extractNumber = (str) => {
                const match = str.match(/(\d+)/);
                return match ? parseInt(match[1]) : null;
            };

            const keywordMap = {
                current: ['本年度積分', '今年積分'],
                expiring: ['即將過期積分', '即將到期', '過期積分'],
                total: ['總積分', '剩餘積分']
            };

            let currentYear = null;
            let expiring = null;
            let total = null;
            const rawMatches = {
                currentYear: 'NOT FOUND',
                expiring: 'NOT FOUND',
                total: 'NOT FOUND'
            };

            const allElements = document.querySelectorAll('div, span, p, label, li, b, strong');

            for (const el of allElements) {
                if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;

                const clone = el.cloneNode(true);
                Array.from(clone.children).forEach(c => c.remove());
                const text = clone.innerText ? clone.innerText.trim() : '';

                if (!text || text.length > 50) continue;

                if (keywordMap.current.some(k => text.includes(k))) {
                    const num = extractNumber(text);
                    if (num !== null) {
                        currentYear = num;
                        rawMatches.currentYear = text;
                    }
                }

                if (keywordMap.expiring.some(k => text.includes(k))) {
                    const num = extractNumber(text);
                    if (num !== null) {
                        expiring = num;
                        rawMatches.expiring = text;
                    }
                }

                if (keywordMap.total.some(k => text.includes(k))) {
                    const num = extractNumber(text);
                    if (num !== null) {
                        total = num;
                        rawMatches.total = text;
                    }
                }
            }

            if (currentYear === null || expiring === null) {
                const currentYearMatch = bodyText.match(/本年度積分[：:\s]*(\d+)/);
                const expiringMatch = bodyText.match(/即將過期積分[：:\s]*(\d+)/);

                if (currentYear === null && currentYearMatch) {
                    currentYear = parseInt(currentYearMatch[1]);
                    rawMatches.currentYear = currentYearMatch[0];
                }

                if (expiring === null && expiringMatch) {
                    expiring = parseInt(expiringMatch[1]);
                    rawMatches.expiring = expiringMatch[0];
                }
            }

            currentYear = currentYear !== null ? currentYear : 0;
            expiring = expiring !== null ? expiring : 0;

            if (total === null) {
                total = currentYear + expiring;
            }

            return {
                currentYear,
                expiring,
                total,
                rawMatches
            };
        });

        console.log('📊 Points Data:');
        console.log(`  Current Year: ${pointsData.currentYear} (${pointsData.rawMatches.currentYear})`);
        console.log(`  Expiring: ${pointsData.expiring} (${pointsData.rawMatches.expiring})`);
        console.log(`  Total: ${pointsData.total} (${pointsData.rawMatches.total})`);
        console.log(`  Eligible (>= 100): ${pointsData.total >= 100 ? '✅ YES' : '❌ NO'}\n`);

        // Test grand prize stock checking
        const prizeInfo = await page.evaluate(() => {
            const stockElements = document.querySelectorAll('.points-show-box-name');
            const prizes = [];

            console.log('Found stock elements:', stockElements.length);

            for (const [index, el] of Array.from(stockElements).entries()) {
                const text = el.innerText || el.textContent || '';
                const contextText = [
                    el.parentElement?.innerText || '',
                    el.parentElement?.parentElement?.innerText || ''
                ].join('\n');
                const isGrandPrize = contextText.includes('特等獎');
                const stockMatch = text.match(/剩餘[：:]?\s*(\d+)/);

                if (stockMatch) {
                    const remaining = parseInt(stockMatch[1]);
                    prizes.push({
                        name: text.split(/剩餘/)[0].trim(),
                        remaining: remaining,
                        hasStock: remaining > 0,
                        isGrandPrize,
                        rawText: text
                    });
                } else if (text.includes('已抽完')) {
                    prizes.push({
                        name: text.split(/已抽完/)[0].trim(),
                        remaining: 0,
                        hasStock: false,
                        isGrandPrize,
                        rawText: text
                    });
                }
            }

            let grandPrizeIndex = prizes.findIndex(p => p.isGrandPrize);
            if (grandPrizeIndex < 0 && prizes.length > 0) {
                grandPrizeIndex = 0;
            }
            prizes.forEach((prize, index) => {
                prize.isGrandPrize = index === grandPrizeIndex;
            });

            const hasAnyStock = prizes.some(p => p.hasStock);
            const grandPrize = prizes.find(p => p.isGrandPrize) || null;
            const hasGrandPrizeStock = !!grandPrize && grandPrize.hasStock;
            return { prizes, hasAnyStock, grandPrize, hasGrandPrizeStock };
        });

        console.log('🎁 Prize Stock Information:');
        if (prizeInfo.prizes.length > 0) {
            prizeInfo.prizes.forEach((prize, idx) => {
                console.log(`\nPrize ${idx + 1}:`);
                console.log(`  Name: ${prize.isGrandPrize ? '[特等獎] ' : ''}${prize.name}`);
                console.log(`  Remaining: ${prize.remaining}`);
                console.log(`  Has Stock: ${prize.hasStock ? '✅ YES' : '❌ NO'}`);
                console.log(`  Raw Text: "${prize.rawText}"`);
            });
            console.log(`\n  Any Stock Available: ${prizeInfo.hasAnyStock ? '✅ YES' : '❌ NO'}`);
            console.log(`  Grand Prize Stock Available: ${prizeInfo.hasGrandPrizeStock ? '✅ YES' : '❌ NO'}`);
        } else {
            console.log('  ⚠️ No prize elements found with stock information');
        }

        // Test lottery button presence
        console.log('\n🎯 Lottery Button Check:');
        const buttonInfo = await page.evaluate(() => {
            const buttons = document.querySelectorAll('.points-draw');
            const buttonData = [];

            buttons.forEach((btn, idx) => {
                buttonData.push({
                    index: idx,
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

        console.log(`  Found ${buttonInfo.count} element(s) with class '.points-draw'`);
        buttonInfo.buttons.forEach(btn => {
            console.log(`\n  Button ${btn.index + 1}:`);
            console.log(`    Tag: ${btn.tag}`);
            console.log(`    Visible: ${btn.visible ? '✅ YES' : '❌ NO'}`);
            console.log(`    Class: "${btn.className}"`);
            console.log(`    Text: "${btn.text}"`);
        });

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('📋 SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Points: ${pointsData.total}`);
        console.log(`Eligible for Lottery: ${pointsData.total >= 100 ? '✅ YES' : '❌ NO'}`);
        console.log(`Prize Stock Available: ${prizeInfo.hasAnyStock ? '✅ YES' : '❌ NO'}`);
        console.log(`Grand Prize Stock Available: ${prizeInfo.hasGrandPrizeStock ? '✅ YES' : '❌ NO'}`);
        console.log(`Lottery Button Found: ${buttonInfo.count > 0 ? '✅ YES' : '❌ NO'}`);

        const hasVisibleLotteryButton = buttonInfo.buttons.some(btn => btn.visible);
        const shouldDraw = !loginInfo.loggedOut && pointsData.total >= 100 && prizeInfo.hasGrandPrizeStock && hasVisibleLotteryButton;
        console.log(`\nShould Execute Lottery: ${shouldDraw ? '✅ YES' : '❌ NO'}`);
        console.log('='.repeat(80));

        if (loginInfo.loggedOut || buttonInfo.count === 0) {
            process.exitCode = 1;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

testLotteryFeature();
