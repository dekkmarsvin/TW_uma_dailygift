# Function I/O Documentation

## Overview

This document provides detailed input/output specifications for all functions in the daily gift automation system.

---

## Core Automation Functions

### `run()`

**Purpose**: Main entry point for the automation script

**Input**: None

**Output**: None (async function)

**Side Effects**:
- Launches browser
- Logs in to website
- Performs daily check-in
- Executes lottery draw if eligible
- Saves cookies
- Logs all activities to `logs/activity.log`

**Error Handling**:
- Captures screenshot on error to `logs/error.png`
- Logs error messages
- Ensures browser is closed in finally block

---

### `saveCookies(context)`

**Purpose**: Save browser cookies to file for future sessions

**Input**:
- `context` (BrowserContext): Playwright browser context

**Output**: None

**Side Effects**:
- Writes cookies to `cookies.json` in project root
- Logs success message

**File Output**: `cookies.json` - JSON array of cookie objects

---

### `loadCookies(context)`

**Purpose**: Load previously saved cookies into browser context

**Input**:
- `context` (BrowserContext): Playwright browser context

**Output**: 
- `boolean` - `true` if cookies loaded successfully, `false` otherwise

**Side Effects**:
- Reads from `cookies.json`
- Adds cookies to browser context
- Logs success or error messages

---

## CAPTCHA Handling

### CAPTCHA Retry Loop

**Purpose**: Attempt to solve CAPTCHA with AI, with retry mechanism

**Constants**:
- `MAX_CAPTCHA_RETRIES` = 3

**Input** (implicit via page state):
- CAPTCHA image element (`.modal-code img`)
- CAPTCHA input field (`input[placeholder="請輸入驗證碼"]`)

**Output**:
- `captchaSolved` (boolean) - `true` if CAPTCHA solved successfully

**Logic Flow**:
1. Attempt 1: 0s wait
2. Attempt 2: 1s wait (2^0 * 1000ms)
3. Attempt 3: 2s wait (2^1 * 1000ms)
4. Failed: 30s manual intervention window

**Success Criteria**:
- Login button becomes clickable (`pointer-events !== 'none'`)

**API Calls**:
- Google Gemini API (`@google/genai`)
- Model: `gemini-1.5-flash` (or from env)

---

## Check-in Feature

### Check-in Status Detection

**Purpose**: Determine if user has already checked in today

**Input** (from page):
- Page body text

**Output** (object):
```javascript
{
    alreadyCheckedIn: boolean,  // true if "已簽到" found
    daysChecked: number | null,  // days checked this month
    hasCheckInButton: boolean    // .sign-btn visible
}
```

**Regex Patterns**:
- Days checked: `/本月已累計簽到\s*(\d+)\s*天/`

### Check-in Button Click

**Purpose**: Click the sign-in button to claim daily reward

**Input**:
- `.sign-btn` element (must be visible)

**Output**:
- `clicked` (boolean) - `true` if button clicked

**Verification**:
- Compare `daysChecked` before and after
- Logs increase in day count

---

## Lottery Feature

### Points Extraction

**Purpose**: Extract current year and expiring points from page

**Input** (from page):
- Page body text

**Output** (object):
```javascript
{
    currentYear: number,  // Current year points
    expiring: number,     // Expiring points
    total: number         // Sum of both
}
```

**Regex Patterns**:
- Current year: `/本年度積分[：:]\s*(\d+)/`
- Expiring: `/即將過期積分[：:]\s*(\d+)/`

**Default Values**:
- If pattern not found: `0`

---

### Prize Stock Check

**Purpose**: Check availability of lottery prizes

**Input**:
- `.points-show-box-name` elements

**Output** (object):
```javascript
{
    prizes: [
        {
            name: string,       // Prize name
            remaining: number,  // Stock count (0 if sold out)
            hasStock: boolean   // remaining > 0
        },
        ...
    ],
    hasAnyStock: boolean  // true if any prize has stock
}
```

**Regex Patterns**:
- Stock count: `/剩餘[：:]?\s*(\d+)/` — matches `剩餘1份`, `剩餘: 10`, `剩餘：5`
- Sold out detection: `text.includes('已抽完')` — marks prize as remaining=0

---

### Lottery Draw Execution

**Purpose**: Click lottery button and capture result

**Eligibility Criteria**:
1. Total points >= 100
2. At least one prize has stock > 0
3. Lottery button (`.points-draw`) exists and visible

**Input**:
- `.points-draw` button element

**Output**:
- `lotteryClicked` (boolean)
- `resultMsg` (string) - User's own result, or fallback message

**Result Extraction Strategy**:
1. **Primary**: Hide marquee (`.points-left-title`) → read `body.innerText` → restore marquee
2. **Fallback**: Click 中獎記錄 (`.points-reward-log`) → read prize history modal
3. **Last resort**: `'Lottery drawn - check manually for result'`

**Result Patterns** (non-greedy to capture single result):
- `/恭喜.*?獲得.*?【(.+?)】/`
- `/抽中了【(.+?)】/`
- `/獲得.*?【(.+?)】/`

**Side Effects**:
- Screenshots result to `logs/lottery_result.png`
- Logs result message

---

## Configuration (`src/config.js`)

### Exports

```javascript
module.exports = {
    targetUrl: string,      // Website URL
    username: string,       // Login email (from .env)
    password: string        // Login password (from .env)
}
```

**Environment Variables** (`.env`):
- `ACCOUNT_EMAIL` - Login email
- `ACCOUNT_PASSWORD` - Login password
- `GEMINI_API_KEY` - Google Gemini API key
- `model` (optional) - Gemini model name (default: gemini-1.5-flash)

---

## Logging (`src/logger.js`)

### Logger Methods

**Available Levels**:
- `logger.info(message)` - General information
- `logger.warn(message)` - Warnings
- `logger.error(message)` - Errors

**Output**:
- Console (colorized)
- File: `logs/activity.log` (timestamped)

**Format**: 
```
YYYY-MM-DD HH:mm:ss <level>: <message>
```

---

## Error Handling Summary

### CAPTCHA Errors
- **Retry**: 3 attempts with exponential backoff
- **Fallback**: 30-second manual intervention window
- **Recovery**: Continue to login attempt

### Login Errors
- **Screenshot**: `logs/error.png`
- **Logging**: Full error stack trace
- **Cleanup**: Browser always closed in finally block

### Lottery Errors
- **Isolation**: Wrapped in try-catch
- **Recovery**: Continues to cookie save and cleanup
- **Logging**: Error logged, execution continues

---

## Browser Configuration

### Playwright Settings

**Launch Options**:
```javascript
{
    headless: false  // Browser visible for CAPTCHA
}
```

**Context Settings**:
```javascript
{
    defaultTimeout: 60000  // 60 seconds
}
```

**Page Waits**:
- `networkidle` - Wait for network to be idle
- Manual timeouts for animations and confirmations

---

## File Outputs

### Generated Files

| File | Purpose | Trigger |
|------|---------|---------|
| `cookies.json` | Saved session cookies | After successful login |
| `logs/activity.log` | All log messages | Every execution |
| `logs/error.png` | Screenshot on error | When error occurs |
| `logs/lottery_result.png` | Lottery result screenshot | After lottery draw |

---

## Return Codes

**Exit Code 0**: Normal completion

**Non-zero**: Error occurred (check `logs/activity.log` and `logs/error.png`)

---

*Last Updated: 2026-02-13*
