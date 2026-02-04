const { chromium } = require('playwright');
const config = require('./src/config');
const fs = require('fs');
const path = require('path');

const COOKIE_PATH = path.join(__dirname, 'cookies.json');

async function testLotteryFeature() {
    console.log('='.repeat(80));
    console.log('🎰 TESTING LOTTERY FEATURE');
    console.log('='.repeat(80));

    const browser = await chromium.launch({ headless: false });
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
        await page.goto(config.targetUrl);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        console.log('\n🔍 Analyzing lottery page elements:\n');

        // Test points extraction
        const pointsData = await page.evaluate(() => {
            const bodyText = document.body.innerText;

            console.log('Page text sample:', bodyText.substring(0, 500));

            // Try to find current year points and expiring points
            const currentYearMatch = bodyText.match(/本年度積分[：:]\s*(\d+)/);
            const expiringMatch = bodyText.match(/即將過期積分[：:]\s*(\d+)/);

            const currentYear = currentYearMatch ? parseInt(currentYearMatch[1]) : 0;
            const expiring = expiringMatch ? parseInt(expiringMatch[1]) : 0;
            const total = currentYear + expiring;

            return {
                currentYear,
                expiring,
                total,
                rawMatches: {
                    currentYear: currentYearMatch ? currentYearMatch[0] : 'NOT FOUND',
                    expiring: expiringMatch ? expiringMatch[0] : 'NOT FOUND'
                }
            };
        });

        console.log('📊 Points Data:');
        console.log(`  Current Year: ${pointsData.currentYear} (${pointsData.rawMatches.currentYear})`);
        console.log(`  Expiring: ${pointsData.expiring} (${pointsData.rawMatches.expiring})`);
        console.log(`  Total: ${pointsData.total}`);
        console.log(`  Eligible (>= 100): ${pointsData.total >= 100 ? '✅ YES' : '❌ NO'}\n`);

        // Test prize stock checking
        const prizeInfo = await page.evaluate(() => {
            const stockElements = document.querySelectorAll('.points-show-box-name');
            const prizes = [];

            console.log('Found stock elements:', stockElements.length);

            for (const el of stockElements) {
                const text = el.innerText || el.textContent || '';
                const stockMatch = text.match(/剩餘[：:]\s*(\d+)/);

                if (stockMatch) {
                    const remaining = parseInt(stockMatch[1]);
                    prizes.push({
                        name: text.split(/剩餘[：:]/)[0].trim(),
                        remaining: remaining,
                        hasStock: remaining > 0,
                        rawText: text
                    });
                }
            }

            const hasAnyStock = prizes.some(p => p.hasStock);
            return { prizes, hasAnyStock };
        });

        console.log('🎁 Prize Stock Information:');
        if (prizeInfo.prizes.length > 0) {
            prizeInfo.prizes.forEach((prize, idx) => {
                console.log(`\nPrize ${idx + 1}:`);
                console.log(`  Name: ${prize.name}`);
                console.log(`  Remaining: ${prize.remaining}`);
                console.log(`  Has Stock: ${prize.hasStock ? '✅ YES' : '❌ NO'}`);
                console.log(`  Raw Text: "${prize.rawText}"`);
            });
            console.log(`\n  Any Stock Available: ${prizeInfo.hasAnyStock ? '✅ YES' : '❌ NO'}`);
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
        console.log(`Lottery Button Found: ${buttonInfo.count > 0 ? '✅ YES' : '❌ NO'}`);

        const shouldDraw = pointsData.total >= 100 && prizeInfo.hasAnyStock && buttonInfo.count > 0;
        console.log(`\nShould Execute Lottery: ${shouldDraw ? '✅ YES' : '❌ NO'}`);
        console.log('='.repeat(80));

        console.log('\nBrowser will stay open for 15 seconds for inspection...');
        await page.waitForTimeout(15000);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await browser.close();
    }
}

testLotteryFeature();
