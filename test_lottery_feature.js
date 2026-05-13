const { chromium } = require('playwright');
const config = require('./src/config');
const fs = require('fs');
const path = require('path');
const UmaPageAdapter = require('./src/adapters/umaPageAdapter');
const { getLotteryDecision } = require('./src/domain/lottery');

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
    const umaPage = new UmaPageAdapter(page, console);

    try {
        if (fs.existsSync(COOKIE_PATH)) {
            const cookiesString = fs.readFileSync(COOKIE_PATH, 'utf8');
            const cookies = JSON.parse(cookiesString);
            await context.addCookies(cookies);
            console.log('✅ Loaded cookies\n');
        }

        console.log('📍 Navigating to website...');
        await waitForPageReady(page);

        console.log('\n🔍 Analyzing lottery page elements:\n');

        const loginInfo = await umaPage.readLoginState();
        console.log('🔐 Login State:');
        console.log(`  Header: "${loginInfo.headerText || '(empty)'}"`);
        console.log(`  Logged Out: ${loginInfo.loggedOut ? '⚠️ YES' : '✅ NO'}\n`);

        const pointsData = await umaPage.readPoints();
        console.log('📊 Points Data:');
        console.log(`  Current Year: ${pointsData.currentYear} (${pointsData.rawMatches.currentYear})`);
        console.log(`  Expiring: ${pointsData.expiring} (${pointsData.rawMatches.expiring})`);
        console.log(`  Total: ${pointsData.total} (${pointsData.rawMatches.total})`);
        console.log(`  Eligible (>= 100): ${pointsData.total >= 100 ? '✅ YES' : '❌ NO'}\n`);

        const prizeInfo = await umaPage.readPrizeStock();
        console.log('🎁 Prize Stock Information:');
        if (prizeInfo.prizes.length > 0) {
            prizeInfo.prizes.forEach((prize, index) => {
                console.log(`\nPrize ${index + 1}:`);
                console.log(`  Name: ${prize.isGrandPrize ? '[特等獎] ' : ''}${prize.name}`);
                console.log(`  Remaining: ${prize.remaining}`);
                console.log(`  Has Stock: ${prize.hasStock ? '✅ YES' : '❌ NO'}`);
            });
            console.log(`\n  Any Stock Available: ${prizeInfo.hasAnyStock ? '✅ YES' : '❌ NO'}`);
            console.log(`  Grand Prize Stock Available: ${prizeInfo.hasGrandPrizeStock ? '✅ YES' : '❌ NO'}`);
        } else {
            console.log('  ⚠️ No prize elements found with stock information');
        }

        console.log('\n🎯 Lottery Button Check:');
        const buttonInfo = await umaPage.readLotteryButtonInfo();
        console.log(`  Found ${buttonInfo.count} element(s) with class '.points-draw'`);
        buttonInfo.buttons.forEach(btn => {
            console.log(`\n  Button ${btn.index + 1}:`);
            console.log(`    Tag: ${btn.tag}`);
            console.log(`    Visible: ${btn.visible ? '✅ YES' : '❌ NO'}`);
            console.log(`    Class: "${btn.className}"`);
            console.log(`    Text: "${btn.text}"`);
        });

        const decision = getLotteryDecision(pointsData, prizeInfo);
        const hasVisibleLotteryButton = buttonInfo.buttons.some(btn => btn.visible);
        const shouldDraw = !loginInfo.loggedOut && decision.shouldDraw && hasVisibleLotteryButton;

        console.log('\n' + '='.repeat(80));
        console.log('📋 SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total Points: ${pointsData.total}`);
        console.log(`Eligible for Lottery: ${pointsData.total >= 100 ? '✅ YES' : '❌ NO'}`);
        console.log(`Prize Stock Available: ${prizeInfo.hasAnyStock ? '✅ YES' : '❌ NO'}`);
        console.log(`Grand Prize Stock Available: ${prizeInfo.hasGrandPrizeStock ? '✅ YES' : '❌ NO'}`);
        console.log(`Lottery Button Found: ${buttonInfo.count > 0 ? '✅ YES' : '❌ NO'}`);
        console.log(`Lottery Decision: ${decision.reason}`);
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
