const { chromium } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./logger');
const DailySummaryLogger = require('./dailySummaryLogger');

const COOKIE_PATH = path.join(__dirname, '../cookies.json');

/**
 * Send Windows notification using MessageBox
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'warning' or 'error'
 */
function sendWindowsNotification(title, message, type = 'warning') {
    try {
        // Escape single quotes for PowerShell
        const escapedTitle = title.replace(/'/g, "''");
        const escapedMessage = message.replace(/'/g, "''");

        const iconType = type === 'error' ? 'Error' : 'Warning';

        const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${escapedMessage}', '${escapedTitle}', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::${iconType})`;

        // Use Start-Process to avoid blocking
        execSync(`powershell -Command "Start-Process powershell -ArgumentList '-Command', \\"${script}\\" -WindowStyle Hidden"`, {
            timeout: 5000,
            windowsHide: true
        });

        logger.info(`Windows notification sent: ${title}`);
    } catch (err) {
        logger.warn('Failed to send Windows notification: ' + err.message);
    }
}


async function saveCookies(context) {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    logger.info('Cookies saved to file.');
}

async function loadCookies(context) {
    if (fs.existsSync(COOKIE_PATH)) {
        const cookiesString = fs.readFileSync(COOKIE_PATH, 'utf8');
        try {
            const cookies = JSON.parse(cookiesString);
            await context.addCookies(cookies);
            logger.info('Cookies loaded from file.');
            logger.info('Login process completed!');
            return true;
        } catch (e) {
            logger.error('Failed to parse cookies.json: ' + e.message);
            return false;
        }
    }
    return false;
}

async function run() {
    logger.info('Starting daily gift automation...');
    const startTime = Date.now();
    const summaryLog = new DailySummaryLogger();
    summaryLog.startSession(new Date());

    let loginType = 'Unknown';
    let captchaUsed = false;

    // Start in headless mode; relaunch headed only if manual intervention is needed
    let isHeadless = true;
    let browser = await chromium.launch({ headless: isHeadless });
    let context = await browser.newContext();
    let page = null;
    let cookiesLoaded = false;

    const initPage = async () => {
        cookiesLoaded = await loadCookies(context);
        if (cookiesLoaded) {
            loginType = 'Auto (Cookie)';
        }

        // Set a long timeout for potentially manual interactions (CAPTCHA)
        context.setDefaultTimeout(60000);

        page = await context.newPage();

        logger.info(`Navigating to ${config.targetUrl}`);
        await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.top-b1', { timeout: 10000 });

        if (cookiesLoaded) {
            logger.info('Cookies loaded. Waiting for session to be applied...');
            try {
                await page.waitForFunction(() => {
                    const header = document.querySelector('.top-b1');
                    const headerText = header ? header.innerText.trim() : '';
                    const hasSignBtn = !!document.querySelector('.sign-btn');
                    return hasSignBtn || headerText.length > 0;
                }, null, { timeout: 8000 });
            } catch (e) {
                logger.warn('Timed out waiting for session apply. Continuing with header check.');
            }
            await page.waitForTimeout(1000);
        }
    };

    const relaunchHeadedForManual = async () => {
        logger.warn('Manual intervention required. Relaunching browser in headed mode...');
        try {
            await browser.close();
        } catch (e) {
            logger.warn('Failed to close headless browser cleanly: ' + e.message);
        }
        isHeadless = false;
        browser = await chromium.launch({ headless: false });
        context = await browser.newContext();
        await initPage();
    };

    try {
        await initPage();

        let loginCompleted = false;

        LOGIN_LOOP:
        while (!loginCompleted) {
            // Check login state
            // Strategies to detect logged out state:
            // 1. "登入" text in header is visible.
            // 2. "Logout" button is missing.

            const headerLoginBtnSelector = '.top-b1';
            // We check if the header login button actually contains "登入" text.

            let isLoggedOut = await page.evaluate(() => {
                const el = document.querySelector('.top-b1');
                return el && el.innerText.includes('登入');
            });

            if (cookiesLoaded && isLoggedOut) {
                logger.info('Login text visible after cookies load. Re-checking after a short wait...');
                await page.waitForTimeout(2000);
                isLoggedOut = await page.evaluate(() => {
                    const el = document.querySelector('.top-b1');
                    return el && el.innerText.includes('登入');
                });
            }

            if (isLoggedOut) {
                logger.info('Not logged in. Initiating login flow...');

                // Click Header Login Button
                await page.click(headerLoginBtnSelector);

                // Wait for popup to animate in
                logger.info('Waiting for login popup...');
                await page.waitForSelector('.login-box', { timeout: 10000 });
                await page.waitForTimeout(1000); // Animation wait

                // SWITCH TO ACCOUNT/PASSWORD MODE
                // The default might be verification code. We need to click "帳號密碼".
                const accountModeBtnSelector = '.login-box .other-login';
                try {
                    // Check if button exists and has text "帳號密碼"
                    const switchBtn = page.locator(accountModeBtnSelector).filter({ hasText: '帳號密碼' });
                    if (await switchBtn.isVisible()) {
                        logger.info('Switching to Account/Password login mode...');
                        await switchBtn.click();
                        await page.waitForTimeout(1000); // Wait for input switch
                    } else {
                        logger.info('Switch button "帳號密碼" not visible. Assuming correct mode or different UI.');
                    }
                } catch (e) {
                    logger.warn('Error trying to switch login mode: ' + e.message);
                }

                // Click "User Agreement" checkbox FIRST (before filling credentials)
                // This ensures the login button becomes clickable
                try {
                    logger.info('Clicking "User Agreement" checkbox...');

                    // Find the VISIBLE checkbox by looking for the privacy text
                    const wasChecked = await page.evaluate(() => {
                        // Strategy: Find all visible radio-boxes in the login box
                        const loginBox = document.querySelector('.login-box');
                        if (!loginBox) return null;

                        const radioBoxes = Array.from(loginBox.querySelectorAll('.radio-box'));

                        // Find the one associated with privacy policy
                        // It should be near text containing "使用者協議" or "隱私權政策"
                        for (const box of radioBoxes) {
                            // Check if this radio-box is visible
                            if (box.offsetWidth === 0 || box.offsetHeight === 0) continue;

                            // Check parent or sibling elements for privacy-related text
                            const parent = box.parentElement;
                            if (parent && parent.innerText) {
                                const text = parent.innerText;
                                if (text.includes('使用者協議') || text.includes('隱私權政策')) {
                                    // Found it! Check if already checked
                                    if (box.classList.contains('active') || box.classList.contains('checked')) {
                                        return true;
                                    }
                                    // Click it
                                    box.click();
                                    return false;
                                }
                            }
                        }

                        return null;
                    });

                    if (wasChecked === true) {
                        logger.info('User Agreement was already checked.');
                    } else if (wasChecked === false) {
                        logger.info('✅ Clicked User Agreement checkbox via JS.');
                        await page.waitForTimeout(500);
                    } else {
                        logger.warn('User Agreement checkbox element not found via JS query. Attempting fallback...');
                        // Fallback: Try clicking the visible privacy line directly
                        try {
                            await page.evaluate(() => {
                                const privacyLines = Array.from(document.querySelectorAll('.tip-line'));
                                for (const line of privacyLines) {
                                    if (line.offsetWidth > 0 && line.offsetHeight > 0 &&
                                        (line.innerText.includes('使用者協議') || line.innerText.includes('隱私權政策'))) {
                                        const radioBox = line.querySelector('.radio-box');
                                        if (radioBox) {
                                            radioBox.click();
                                            return true;
                                        }
                                    }
                                }
                                return false;
                            });
                            logger.info('✅ Clicked User Agreement checkbox via fallback.');
                            await page.waitForTimeout(500);
                        } catch (e) {
                            logger.error('Fallback also failed: ' + e.message);
                        }
                    }

                } catch (e) {
                    logger.warn('Could not click User Agreement checkbox: ' + e.message);
                }

                // Fill Credentials AFTER checking agreement
                const usernameSelector = 'input[placeholder*="信箱"]';
                const passwordSelector = 'input[placeholder="請輸入密碼"]';

                logger.info('Filling credentials...');

                // Wait for password field to verify we are in the correct mode
                try {
                    await page.waitForSelector(passwordSelector, { timeout: 3000 });
                } catch (e) {
                    logger.warn('Password field not immediately found. Retrying mode switch or filling anyway...');
                }

                // Fill username
                const usernameInput = page.locator(usernameSelector).first();
                await usernameInput.fill(config.username);
                logger.info('✅ Username filled.');

                // Fill password
                const passwordInput = page.locator(passwordSelector).first();
                await passwordInput.fill(config.password);
                logger.info('✅ Password filled.');

                // CAPTCHA HANDLING WITH RETRY MECHANISM
                const MAX_CAPTCHA_RETRIES = 3;
                let captchaAttempt = 0;
                let captchaSolved = false;

                while (captchaAttempt < MAX_CAPTCHA_RETRIES && !captchaSolved) {
                    try {
                        captchaAttempt++;
                        logger.info(`CAPTCHA attempt ${captchaAttempt}/${MAX_CAPTCHA_RETRIES}...`);

                        const captchaImageSelector = '.modal-code img';
                        const captchaInputSelector = 'input[placeholder="請輸入驗證碼"]';

                        if (await page.isVisible(captchaImageSelector)) {
                            logger.info('CAPTCHA found. Attempting to solve with AI...');

                            // Capture CAPTCHA screenshot
                            const captchaElement = await page.locator(captchaImageSelector).first();
                            const buffer = await captchaElement.screenshot();
                            const base64Image = buffer.toString('base64');

                            // Initialize Gemini (New SDK @google/genai)
                            const { GoogleGenAI } = require('@google/genai');
                            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

                            // Use model from env or fall back to default
                            const modelName = process.env.model || "gemini-3-flash-preview";

                            logger.info(`Using Gemini Model: ${modelName}`);

                            const result = await ai.models.generateContent({
                                model: modelName,
                                contents: [
                                    {
                                        inlineData: {
                                            mimeType: "image/png",
                                            data: base64Image
                                        }
                                    },
                                    { text: "Return ONLY the alphanumeric verification code you see in this image. Do not include spaces or other text." }
                                ]
                            });

                            let text = '';
                            if (typeof result.text === 'function') {
                                text = result.text();
                            } else if (result.response && typeof result.response.text === 'function') {
                                text = result.response.text();
                            } else if (result.text) {
                                text = result.text;
                            }
                            const code = text ? text.trim().replace(/\s/g, '') : '';
                            logger.info(`AI Solved CAPTCHA: ${code}`);

                            if (code) {
                                // Clear previous input and fill new code
                                await page.fill(captchaInputSelector, '');
                                await page.fill(captchaInputSelector, code);
                                logger.info('CAPTCHA code filled. Verifying...');

                                // Wait briefly for validation
                                await page.waitForTimeout(1000);

                                // Check if login button becomes clickable (indicates CAPTCHA success)
                                try {
                                    await page.waitForFunction(() => {
                                        const loginBtn = Array.from(document.querySelectorAll('.login-box .login-btn'))
                                            .find(b => b.innerText.trim() === '登入');
                                        if (loginBtn) {
                                            const pointerEvents = window.getComputedStyle(loginBtn).pointerEvents;
                                            return pointerEvents !== 'none';
                                        }
                                        return false;
                                    }, null, { timeout: 3000 });

                                    logger.info(`✅ CAPTCHA solved successfully on attempt ${captchaAttempt}!`);
                                    captchaSolved = true;
                                    break;
                                } catch (e) {
                                    logger.warn(`⚠️ CAPTCHA attempt ${captchaAttempt} failed - button not clickable`);

                                    if (captchaAttempt < MAX_CAPTCHA_RETRIES) {
                                        // Try to refresh CAPTCHA if refresh button exists
                                        try {
                                            const refreshBtn = await page.locator('.modal-code .refresh, .modal-code .icon-refresh').first();
                                            if (await refreshBtn.isVisible({ timeout: 1000 })) {
                                                await refreshBtn.click();
                                                logger.info('Refreshed CAPTCHA image');
                                            }
                                        } catch (refreshErr) {
                                            // No refresh button or click failed, continue anyway
                                        }

                                        // Exponential backoff: 1s, 2s, 4s
                                        const waitTime = Math.pow(2, captchaAttempt - 1) * 1000;
                                        logger.info(`Waiting ${waitTime}ms before retry...`);
                                        await page.waitForTimeout(waitTime);
                                    }
                                }
                            } else {
                                logger.warn(`No CAPTCHA code extracted on attempt ${captchaAttempt}`);

                                if (captchaAttempt < MAX_CAPTCHA_RETRIES) {
                                    const waitTime = Math.pow(2, captchaAttempt - 1) * 1000;
                                    await page.waitForTimeout(waitTime);
                                }
                            }
                        } else {
                            logger.info('No CAPTCHA image visible. Skipping...');
                            captchaSolved = true; // No CAPTCHA needed
                            break;
                        }
                    } catch (err) {
                        logger.error(`CAPTCHA attempt ${captchaAttempt} error: ${err.message}`);
                        if (err.message.includes('not supported') || err.message.includes('404')) {
                            logger.warn('Model might be invalid. Please check .env for "model" variable.');
                        }

                        if (captchaAttempt < MAX_CAPTCHA_RETRIES) {
                            const waitTime = Math.pow(2, captchaAttempt - 1) * 1000;
                            await page.waitForTimeout(waitTime);
                        }
                    }
                }

                if (!captchaSolved && captchaAttempt >= MAX_CAPTCHA_RETRIES) {
                    const msg = 'CAPTCHA自動識別失敗，請手動輸入驗證碼後繼續';
                    logger.warn('❌ CAPTCHA retry limit reached. Manual intervention required.');
                    sendWindowsNotification('UMA 每日禮物 - 需要協助', msg, 'warning');
                    captchaUsed = true;

                    if (isHeadless) {
                        logger.warn('Headless mode detected. Switching to headed browser for manual CAPTCHA input.');
                        await relaunchHeadedForManual();
                        continue LOGIN_LOOP;
                    }

                    logger.warn('Please solve CAPTCHA manually and press Enter to continue...');
                    await page.waitForTimeout(30000); // Give user 30 seconds
                } else if (captchaSolved) {
                    captchaUsed = true;
                }
                loginType = 'Manual (Password)';


                // Click Login Submit
                logger.info('Attempting to click Submit Login button...');

                // First, check if the button is clickable
                const buttonState = await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('.login-box .login-btn'))
                        .find(b => b.innerText.trim() === '登入');
                    if (btn) {
                        const pointerEvents = window.getComputedStyle(btn).pointerEvents;
                        const disabled = btn.disabled || btn.classList.contains('disabled') || btn.classList.contains('dis');
                        return {
                            found: true,
                            clickable: pointerEvents !== 'none' && !disabled,
                            pointerEvents: pointerEvents,
                            disabled: disabled
                        };
                    }
                    return { found: false };
                });

                logger.info(`Button state: ${JSON.stringify(buttonState)}`);

                if (!buttonState.found) {
                    logger.error('❌ Login button not found!');
                    throw new Error('Login button not found');
                }

                if (!buttonState.clickable) {
                    logger.warn('⚠️ Login button is not clickable. Possible reasons:');
                    logger.warn(`  - Pointer events: ${buttonState.pointerEvents}`);
                    logger.warn(`  - Disabled: ${buttonState.disabled}`);
                    logger.warn('This usually means CAPTCHA is incorrect or form validation failed.');
                    logger.warn('Waiting 10 seconds for manual intervention...');
                    await page.waitForTimeout(10000);
                }

                // Try to click the button using evaluate (JS click)
                const loginClicked = await page.evaluate((selector) => {
                    const btns = Array.from(document.querySelectorAll(selector));
                    // Filter for button that contains "Login" text exactly or close to it
                    const target = btns.find(b => b.innerText.trim() === '登入');
                    if (target) {
                        target.click();
                        return true;
                    }
                    return false;
                }, '.login-box .login-btn');

                if (loginClicked) {
                    logger.info('✅ Login button clicked via JS.');
                } else {
                    logger.warn('Could not find Login button via JS. Attempting Playwright fallback...');
                    const submitLoginBtn = page.locator('.login-box .login-btn').filter({ hasText: /^登入$/ }).first();
                    await submitLoginBtn.click({ force: true });
                }

                // Wait for login to complete (Login button in header changes or disappears)
                logger.info('WAITING FOR LOGIN TO COMPLETE...');
                logger.info('>>> PLEASE SOLVE CAPTCHA MANUALLY IF PROMPTED <<<');

                await page.waitForFunction(() => {
                    const el = document.querySelector('.top-b1');
                    return !el || !el.innerText.includes('登入');
                }, null, { timeout: 120000 }); // 2 minute timeout

                logger.info('Login successful!');
                await saveCookies(context);
                loginCompleted = true;

            } else {
                logger.info('Already logged in.');
                loginType = 'Auto (Cookie)';
                loginCompleted = true;
            }
        }

        // Give page a moment to settle after login
        await page.waitForTimeout(3000);

        // Now handling Check-in
        logger.info('======================================');
        logger.info('CHECKING DAILY CHECK-IN STATUS');
        logger.info('======================================');

        // First, check if already checked in today
        const checkinStatus = await page.evaluate(() => {
            // Look for text indicating already checked in
            const bodyText = document.body.innerText;

            // Check for "已簽到" or "已累計簽到"
            const alreadyCheckedIn = bodyText.includes('已簽到') || bodyText.includes('已累計簽到');

            // Try to find the sign-in count
            const signMatch = bodyText.match(/本月已累計簽到\s*(\d+)\s*天/);
            const daysChecked = signMatch ? parseInt(signMatch[1]) : null;

            // Look for the check-in button using class .sign-btn
            const signBtns = document.querySelectorAll('.sign-btn');
            let checkInBtn = null;
            let buttonState = null;

            for (const btn of signBtns) {
                if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                    checkInBtn = btn;

                    // Check button state via CSS and attributes
                    const computedStyle = window.getComputedStyle(btn);
                    const filter = computedStyle.filter || '';
                    const pointerEvents = computedStyle.pointerEvents || '';
                    const opacity = computedStyle.opacity || '1';
                    const disabled = btn.disabled || btn.hasAttribute('disabled');
                    const classList = Array.from(btn.classList);

                    // Button is considered "already checked in" if:
                    // 1. Has grayscale filter
                    // 2. pointer-events is 'none'
                    // 3. Is disabled
                    // 4. Has opacity < 0.5
                    // 5. Has class 'disabled' or 'dis' or 'inactive'
                    const isGrayscale = filter.includes('grayscale') && filter.includes('1');
                    const isNotClickable = pointerEvents === 'none';
                    const isLowOpacity = parseFloat(opacity) < 0.5;
                    const hasDisabledClass = classList.some(c =>
                        c.includes('disabled') || c === 'dis' || c.includes('inactive')
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

                    break;
                }
            }

            return {
                alreadyCheckedIn,
                daysChecked,
                hasCheckInButton: !!checkInBtn,
                buttonState
            };
        });

        logger.info(`Check-in Status:`);
        logger.info(`  - Text indicates already checked in: ${checkinStatus.alreadyCheckedIn ? 'YES' : 'NO'}`);
        logger.info(`  - Days checked this month: ${checkinStatus.daysChecked !== null ? checkinStatus.daysChecked : 'Unknown'}`);
        logger.info(`  - Check-in button (.sign-btn) visible: ${checkinStatus.hasCheckInButton ? 'YES' : 'NO'}`);

        // Log detailed button state if button exists
        if (checkinStatus.buttonState) {
            logger.info(`  - Button State Details:`);
            logger.info(`    • Filter: ${checkinStatus.buttonState.filter || 'none'}`);
            logger.info(`    • Pointer Events: ${checkinStatus.buttonState.pointerEvents}`);
            logger.info(`    • Opacity: ${checkinStatus.buttonState.opacity}`);
            logger.info(`    • Disabled: ${checkinStatus.buttonState.disabled}`);
            logger.info(`    • Classes: ${checkinStatus.buttonState.classList || 'none'}`);
            logger.info(`    • Is Grayscale: ${checkinStatus.buttonState.isGrayscale ? 'YES' : 'NO'}`);
            logger.info(`    • Is Not Clickable: ${checkinStatus.buttonState.isNotClickable ? 'YES' : 'NO'}`);
            logger.info(`    • Is Low Opacity: ${checkinStatus.buttonState.isLowOpacity ? 'YES' : 'NO'}`);
            logger.info(`    • Has Disabled Class: ${checkinStatus.buttonState.hasDisabledClass ? 'YES' : 'NO'}`);
            logger.info(`    • Overall Disabled by Style: ${checkinStatus.buttonState.isDisabledByStyle ? 'YES' : 'NO'}`);
        }

        // IMPROVED: Check button state ONLY (User request: 移除文字內容檢測，僅判斷按鈕狀態)
        const isAlreadyCheckedIn = checkinStatus.buttonState && checkinStatus.buttonState.isDisabledByStyle;

        if (isAlreadyCheckedIn) {
            logger.info('✅ Already checked in today! (Detected via button state)');
            logger.info(`📊 Monthly check-in progress: ${checkinStatus.daysChecked} days`);
            summaryLog.logCheckIn('Already checked in', null, checkinStatus.daysChecked, null);
        } else if (checkinStatus.hasCheckInButton) {
            // Try to click the check-in button
            try {
                logger.info('🎯 Check-in button (.sign-btn) found! Attempting to check in...');

                // Click using JavaScript evaluate with .sign-btn
                const clicked = await page.evaluate(() => {
                    const btns = document.querySelectorAll('.sign-btn');
                    for (const btn of btns) {
                        if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                            btn.click();
                            return true;
                        }
                    }
                    return false;
                });

                const checkInButton = clicked;
                if (checkInButton) {
                    logger.info('✅ Successfully clicked check-in button (.sign-btn)!');

                    // Wait for confirmation and check the new status
                    await page.waitForTimeout(3000);

                    // Verify check-in was successful
                    const newStatus = await page.evaluate(() => {
                        const bodyText = document.body.innerText;
                        const signMatch = bodyText.match(/本月已累計簽到\s*(\d+)\s*天/);
                        return signMatch ? parseInt(signMatch[1]) : null;
                    });

                    if (newStatus !== null && newStatus > checkinStatus.daysChecked) {
                        logger.info(`✅ Check-in successful! Total days: ${newStatus} (was ${checkinStatus.daysChecked})`);
                        summaryLog.logCheckIn('Success', checkinStatus.daysChecked, newStatus, 'Daily Bonus');
                    } else if (newStatus !== null) {
                        logger.info(`📊 Current total days: ${newStatus}`);
                        summaryLog.logCheckIn('Success', checkinStatus.daysChecked, newStatus, 'Daily Bonus'); // Log even if no change detected, assuming click was successful
                    } else {
                        logger.warn('Could not verify new check-in status.');
                        summaryLog.logCheckIn('Failed', checkinStatus.daysChecked, null, 'Daily Bonus');
                    }
                } else {
                    logger.warn('⚠️ Could not click .sign-btn button.');
                    summaryLog.logCheckIn('Failed', checkinStatus.daysChecked, null, 'Daily Bonus');
                }
            } catch (e) {
                logger.warn('Failed to click check-in button: ' + e.message);
                summaryLog.logCheckIn('Error', checkinStatus.daysChecked, null, 'Daily Bonus', e.message);
            }
        } else {
            logger.warn('⚠️ Could not determine check-in status. Check manually.');
            summaryLog.logCheckIn('Unknown', checkinStatus.daysChecked, null, null, 'Could not determine status');
        }

        logger.info('======================================');


        // LOTTERY FEATURE
        logger.info('======================================');
        logger.info('CHECKING LOTTERY ELIGIBILITY');
        logger.info('======================================');

        try {
            // Extract points data from the page using DOM traversal for better accuracy
            const pointsData = await page.evaluate(() => {
                const bodyText = document.body.innerText;

                // Helper to clean non-numeric characters
                const extractNumber = (str) => {
                    const match = str.match(/(\d+)/);
                    return match ? parseInt(match[1]) : null;
                };

                // Strategy 1: Find elements containing specific keywords
                const keywordMap = {
                    current: ['本年度積分', '今年積分'],
                    expiring: ['即將過期積分', '即將到期', '過期積分'],
                    total: ['總積分', '剩餘積分']
                };

                let currentYear = null;
                let expiring = null;
                let total = null;
                let debugInfo = [];

                // Find all potential text elements
                const allElements = document.querySelectorAll('div, span, p, label, li, b, strong');

                for (const el of allElements) {
                    if (el.offsetWidth === 0 || el.offsetHeight === 0) continue;

                    // Direct text content of this node only (avoiding children text)
                    const clone = el.cloneNode(true);
                    Array.from(clone.children).forEach(c => c.remove());
                    const text = clone.innerText ? clone.innerText.trim() : '';

                    if (!text || text.length > 50) continue;

                    if (text.includes('積分')) {
                        debugInfo.push(`Found '積分' in <${el.tagName.toLowerCase()}>: "${text}"`);
                    }

                    // Check for Current Year
                    if (keywordMap.current.some(k => text.includes(k))) {
                        const num = extractNumber(text);
                        if (num !== null) currentYear = num;
                    }

                    // Check for Expiring
                    if (keywordMap.expiring.some(k => text.includes(k))) {
                        const num = extractNumber(text);
                        if (num !== null) expiring = num;
                    }

                    // Check for Total
                    if (keywordMap.total.some(k => text.includes(k))) {
                        const num = extractNumber(text);
                        if (num !== null) total = num;
                    }
                }

                // Strategy 2: Fallback to regex on Body Text
                if (currentYear === null || expiring === null) {
                    const currentYearMatch = bodyText.match(/本年度積分[：:\s]*(\d+)/);
                    const expiringMatch = bodyText.match(/即將過期積分[：:\s]*(\d+)/);

                    if (currentYear === null && currentYearMatch) currentYear = parseInt(currentYearMatch[1]);
                    if (expiring === null && expiringMatch) expiring = parseInt(expiringMatch[1]);
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
                    debugInfo: debugInfo.slice(0, 15)
                };
            });

            logger.info(`Points Summary:`);
            logger.info(`  - Current year points: ${pointsData.currentYear}`);
            logger.info(`  - Expiring points: ${pointsData.expiring}`);
            logger.info(`  - Total points: ${pointsData.total}`);

            // DEBUG: Log found elements
            if (pointsData.debugInfo.length > 0) {
                logger.info(`Debug - Visible Elements with '積分':`);
                pointsData.debugInfo.forEach(info => logger.info(`  - ${info}`));
            }

            summaryLog.logPoints(pointsData.currentYear, pointsData.expiring, pointsData.total);

            if (pointsData.total < 100) {
                logger.info(`❌ Total points (${pointsData.total}) is less than 100. Skipping lottery.`);
                summaryLog.logLottery('Skipped', `Points insufficient (${pointsData.total}/100)`);
            } else {
                logger.info(`✅ Total points (${pointsData.total}) >= 100. Checking prize availability...`);

                // Check if any prizes have stock available
                const prizeStockInfo = await page.evaluate(() => {
                    const stockElements = document.querySelectorAll('.points-show-box-name');
                    const prizes = [];

                    for (const el of stockElements) {
                        const text = el.innerText || el.textContent || '';
                        // Look for patterns like "剩餘1份", "剩餘: 10", "剩餘：5"
                        const stockMatch = text.match(/剩餘[：:]?\s*(\d+)/);

                        if (stockMatch) {
                            const remaining = parseInt(stockMatch[1]);
                            prizes.push({
                                name: text.split(/剩餘/)[0].trim(),
                                remaining: remaining,
                                hasStock: remaining > 0
                            });
                        } else if (text.includes('已抽完')) {
                            // Prize is sold out
                            prizes.push({
                                name: text.split(/已抽完/)[0].trim(),
                                remaining: 0,
                                hasStock: false
                            });
                        }
                    }

                    const hasAnyStock = prizes.some(p => p.hasStock);
                    return { prizes, hasAnyStock };
                });

                logger.info(`Prize Stock Status:`);
                if (prizeStockInfo.prizes.length > 0) {
                    prizeStockInfo.prizes.forEach(prize => {
                        logger.info(`  - ${prize.name}: ${prize.remaining} remaining ${prize.hasStock ? '✅' : '❌'}`);
                    });
                } else {
                    logger.info(`  - No prize information found`);
                }

                if (prizeStockInfo.hasAnyStock) {
                    logger.info(`🎰 Prize stock available! Attempting lottery draw...`);

                    // Click lottery button
                    const lotteryClicked = await page.evaluate(() => {
                        const buttons = document.querySelectorAll('.points-draw');
                        for (const btn of buttons) {
                            if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
                                btn.click();
                                return true;
                            }
                        }
                        return false;
                    });

                    if (lotteryClicked) {
                        logger.info('✅ Lottery button (.points-draw) clicked!');

                        // Wait for lottery result
                        await page.waitForTimeout(3000);

                        // Try to capture the result from modal/popup
                        const lotteryResult = await page.evaluate(() => {
                            // Hide the marquee (.points-left-title) to exclude other users' records
                            const marquee = document.querySelector('.points-left-title');
                            if (marquee) marquee.style.display = 'none';

                            // Try to find result patterns from the page (excluding marquee)
                            const bodyText = document.body.innerText;

                            // Restore marquee
                            if (marquee) marquee.style.display = '';

                            const resultPatterns = [
                                /恭喜.*?獲得.*?【(.+?)】/,
                                /抽中了【(.+?)】/,
                                /獲得.*?【(.+?)】/
                            ];

                            for (const pattern of resultPatterns) {
                                const match = bodyText.match(pattern);
                                if (match) {
                                    return match[0];
                                }
                            }

                            return null;
                        });

                        // Fallback: click 中獎記錄 to get user's own prize history
                        let finalResult = lotteryResult;
                        if (!finalResult) {
                            try {
                                const historyBtn = page.locator('.points-reward-log');
                                if (await historyBtn.isVisible()) {
                                    await historyBtn.click();
                                    await page.waitForTimeout(1000);
                                    // Read the first entry from prize history modal
                                    finalResult = await page.evaluate(() => {
                                        // Look for the newest history entry in any visible modal/popup
                                        const visibleText = document.body.innerText;
                                        const historyMatch = visibleText.match(/抽中了【(.+?)】/);
                                        return historyMatch ? historyMatch[0] : null;
                                    });
                                }
                            } catch (e) {
                                // Ignore history button errors
                            }
                        }

                        const resultMsg = finalResult || 'Lottery drawn - check manually for result';

                        logger.info(`🎁 Lottery Result: ${resultMsg}`);
                        summaryLog.logLottery('Success', resultMsg);

                        // Take screenshot of result
                        try {
                            const lotteryScreenshot = path.join(__dirname, '../logs/lottery_result.png');
                            await page.screenshot({ path: lotteryScreenshot, fullPage: true });
                            logger.info(`Screenshot saved: ${lotteryScreenshot}`);
                        } catch (screenshotErr) {
                            logger.warn('Could not save lottery screenshot');
                        }
                    } else {
                        logger.warn('⚠️ Could not find or click lottery button (.points-draw)');
                    }
                } else {
                    logger.info(`❌ No prizes with stock available. Skipping lottery.`);
                    summaryLog.logLottery('Skipped', 'No prize stock available');
                }
            }
        } catch (lotteryError) {
            logger.error(`Lottery feature error: ${lotteryError.message}`);
            logger.info('Continuing with cleanup...');
        }

        logger.info('======================================');


        // Final cookie save
        await saveCookies(context);

        // Finalize daily summary log
        const duration = Math.round((Date.now() - startTime) / 1000);
        const durationStr = duration >= 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;
        summaryLog.logSummary(loginType, captchaUsed, durationStr);
        summaryLog.finalize();
        logger.info('Daily summary logged.');

    } catch (error) {
        const errorMsg = `執行錯誤: ${error.message}`;
        logger.error(`Error: ${error.message}`);
        sendWindowsNotification('UMA 每日禮物 - 執行失敗', errorMsg, 'error');

        // Capture screenshot on error
        try {
            if (page) {
                const errorScreenshotPath = path.join(__dirname, '../logs/error.png');
                logger.info(`Saving screenshot to: ${errorScreenshotPath}`);
                await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            } else {
                logger.warn('Page object is null, cannot take screenshot.');
            }
        } catch (err) {
            logger.error(`Could not save screenshot: ${err.message}`);
        }
    } finally {
        await browser.close();
        logger.info('Browser closed.');
    }
}

if (require.main === module) {
    run();
}

module.exports = { run };
