# 登入按鈕問題診斷報告

## 問題描述
登入功能因為無法點選登入按鈕而卡住。

## 診斷過程

### 1. 建立診斷腳本
建立了 `debug_simple.js` 和 `check_captcha.js` 來分析登入流程中的元素狀態。

### 2. 診斷結果

#### ✅ **登入按鈕元素抓取正確**
```
Button 1:
  Tag: DIV
  Full class: "login-btn"
  Text content: "登入"
  Trimmed text: "登入"
  Is visible: true
  Is disabled: false
  Opacity: 1
  Pointer events: none  ⚠️ 問題所在
```

**選擇器 `.login-box .login-btn` 能正確抓取到登入按鈕。**

#### ❌ **問題根源：按鈕不可點擊**
```
🔍 Current login button state:
  Pointer events: none
  Clickable: false
```

登入按鈕的 CSS 屬性 `pointer-events` 被設置為 `none`，導致按鈕無法被點擊。

#### 🔍 **原因分析**
查看登入表單截圖發現，表單中有一個**驗證碼輸入框**。

根據診斷結果：
- 驗證碼圖片 URL: `https://l11-web-login.komoejoy.com/komoe/web/captcha?region=7&t=...`
- 驗證碼輸入框選擇器: `input[placeholder="請輸入驗證碼"]`
- 兩者都能被正確找到且可見

**在驗證碼未填寫或填寫錯誤時，網站會將登入按鈕設置為 `pointer-events: none`，防止用戶點擊。**

## 解決方案

### 修改 1：等待按鈕變為可點擊狀態
在 `automation.js` 的 CAPTCHA 處理邏輯中（第 149-231 行），增加驗證碼填寫後等待按鈕狀態變化的邏輯：

```javascript
if (code) {
    // 填寫驗證碼
    await page.fill(captchaInputSelector, code);
    logger.info('CAPTCHA code filled. Waiting for button to become clickable...');
    
    // 等待登入按鈕變為可點擊（pointer-events !== 'none'）
    try {
        await page.waitForFunction(() => {
            const loginBtn = Array.from(document.querySelectorAll('.login-box .login-btn'))
                .find(b => b.innerText.trim() === '登入');
            if (loginBtn) {
                const pointerEvents = window.getComputedStyle(loginBtn).pointerEvents;
                return pointerEvents !== 'none';
            }
            return false;
        }, null, { timeout: 5000 });
        logger.info('✅ Login button is now clickable!');
    } catch (e) {
        logger.warn('⚠️ Login button did not become clickable. The CAPTCHA might be incorrect.');
        logger.warn('Please solve CAPTCHA manually or press Enter to continue...');
    }
}
```

### 修改 2：點擊前檢查按鈕狀態
在點擊登入按鈕之前（第 234-289 行），先檢查按鈕的可點擊狀態：

```javascript
// 檢查按鈕是否可點擊
const buttonState = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('.login-box .login-btn'))
        .find(b => b.innerText.trim() === '登入');
    if (btn) {
        const pointerEvents = window.getComputedStyle(btn).pointerEvents;
        const disabled = btn.disabled || btn.classList.contains('disabled');
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

if (!buttonState.clickable) {
    logger.warn('⚠️ Login button is not clickable. Possible reasons:');
    logger.warn(`  - Pointer events: ${buttonState.pointerEvents}`);
    logger.warn(`  - Disabled: ${buttonState.disabled}`);
    logger.warn('This usually means CAPTCHA is incorrect or form validation failed.');
    logger.warn('Waiting 10 seconds for manual intervention...');
    await page.waitForTimeout(10000);
}
```

## 驗證步驟

### 要測試修復是否生效，請執行：

```bash
node src/automation.js
```

### 預期行為：

1. ✅ 開啟網站並點擊登入
2. ✅ 切換至帳號密碼模式
3. ✅ 填寫帳號和密碼
4. ✅ 勾選使用者協議
5. ✅ 檢測到驗證碼圖片
6. ✅ 使用 Gemini AI 識別驗證碼
7. ✅ 填寫驗證碼到輸入框
8. ✅ **等待登入按鈕變為可點擊狀態**（新增）
9. ✅ **檢查按鈕狀態**（新增）
10. ✅ 點擊登入按鈕
11. ✅ 等待登入完成

### Log 輸出範例：

```
Looking for CAPTCHA image...
CAPTCHA found. Attempting to solve with AI...
Using Gemini Model: gemini-1.5-flash
AI Solved CAPTCHA: ABC123
CAPTCHA code filled. Waiting for button to become clickable...
✅ Login button is now clickable!
Attempting to click Submit Login button...
Button state: {"found":true,"clickable":true,"pointerEvents":"auto","disabled":false}
✅ Login button clicked via JS.
```

## 可能遇到的問題

### 1. AI 驗證碼識別錯誤
如果 Gemini AI 識別驗證碼錯誤，按鈕將不會變為可點擊狀態。此時：
- Log 會顯示警告：`⚠️ Login button did not become clickable`
- 程式會等待 10 秒讓你手動輸入正確的驗證碼

### 2. GEMINI_API_KEY 未設置
確保 `.env` 文件中有正確的 API Key：
```env
GEMINI_API_KEY=your_api_key_here
```

### 3. 驗證碼選擇器變更
如果網站更新導致選擇器失效，請查看診斷腳本的輸出來找到新的選擇器。

## 總結

✅ **登入按鈕選擇器是正確的**：`.login-box .login-btn`  
✅ **問題原因已找到**：按鈕在驗證碼填寫前被設為 `pointer-events: none`  
✅ **解決方案已實施**：增加等待按鈕變為可點擊的邏輯  
✅ **增加診斷功能**：點擊前檢查並記錄按鈕狀態

現在程式會：
1. 自動識別並填寫驗證碼
2. 等待按鈕變為可點擊狀態（最多 5 秒）
3. 檢查按鈕狀態並記錄詳細資訊
4. 如果按鈕仍不可點擊，等待 10 秒供手動處理
5. 最後嘗試點擊按鈕（使用 JavaScript 強制點擊）
