# UMA Daily Gift Automation

自動化領取 UMA 網站 (uma.komoejoy.com) 每日簽到獎勵的 Node.js 應用程式。

## ✨ 功能特性

- ✅ **自動登入** - Cookie 自動保存/載入，避免每次手動登入
- ✅ **智能驗證碼識別** - 使用 Google Gemini AI 自動識別驗證碼（含重試機制）
- ✅ **每日簽到** - 自動點擊簽到按鈕領取獎勵
- ✅ **自動抽獎** - 當積分達到 100 分且有獎品庫存時自動參與抽獎
- ✅ **Windows 通知** - 失敗時彈出提醒視窗通知使用者
- ✅ **每日摘要日誌** - 結構化記錄每日簽到、積分、抽獎結果
- ✅ **完整日誌系統** - 技術日誌 (activity.log) + 使用者友善摘要 (daily-summary.log)

## 📋 需求

- **Node.js** >= 16.0.0
- **npm** >= 7.0.0
- **Windows** OS (for notifications)
- **Google Gemini API Key** ([申請連結](https://aistudio.google.com/app/apikey))

## 🚀 安裝步驟

### 1. Clone 專案

```bash
git clone https://github.com/your-username/TW_uma_dailygift.git
cd TW_uma_dailygift
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 設定環境變數

複製 `.env.example` 為 `.env`：

```bash
copy .env.example .env
```

編輯 `.env` 並填入您的資訊：

```env
login_username=your_email@example.com
login_password=your_password_here
GEMINI_API_KEY=your_gemini_api_key_here
model=gemini-1.5-flash
```

**重要**: 請確保 `.env` 檔案安全，不要提交至 Git！

### 4. 取得 Gemini API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey)
2. 登入 Google 帳號
3. 點擊 "Create API Key"
4. 將 API Key 複製到 `.env` 的 `GEMINI_API_KEY`

## 💻 使用方式

### 手動執行

```bash
node src/automation.js
```

### Windows 排程執行

請參閱 [SETUP_SCHEDULER.md](SETUP_SCHEDULER.md) 設定 Windows 工作排程器。

建議設定：每天上午 9:00 自動執行

## 📊 日誌檔案

### activity.log
技術層級的詳細日誌，包含：
- 所有操作步驟
- 錯誤訊息與堆疊追蹤
- 除錯資訊

位置: `logs/activity.log`

### daily-summary.log
使用者友善的每日摘要，包含：
- ✅ 簽到狀態與累積天數
- 💰 積分資訊（本年度 + 即將過期 + 總計）
- 🎰 抽獎結果
- 📊 執行摘要（登入方式、驗證碼、執行時間）

位置: `logs/daily-summary.log`

範例：
```
====================================================
2026-02-04
====================================================
✅ Check-in: Success
   - Days checked: 3 → 4
   - Reward: Daily Bonus

💰 Points:
   - Current year: 40
   - Expiring: 40
   - Total: 80

🎰 Lottery: Skipped
   - Points insufficient (80/100)

📊 Summary:
   - Login: Auto (Cookie)
   - CAPTCHA: Not required
   - Duration: 15s
====================================================
```

### scheduler.log
PowerShell 排程腳本的執行日誌

位置: `logs/scheduler.log`

## 🔔 通知系統

當發生以下情況時，系統會彈出 Windows 通知視窗：

- ⚠️ **CAPTCHA 識別失敗** - 需要手動輸入驗證碼
- ❌ **登入失敗** - 帳號密碼可能錯誤
- ❌ **執行錯誤** - 發生嚴重錯誤

## 🛠️ 專案結構

```
TW_uma_dailygift/
├── src/
│   ├── automation.js          # 主要自動化邏輯
│   ├── config.js              # 設定檔
│   ├── logger.js              # 日誌系統
│   └── dailySummaryLogger.js  # 每日摘要日誌
├── logs/
│   ├── activity.log           # 技術日誌
│   ├── daily-summary.log      # 每日摘要
│   └── scheduler.log          # 排程日誌
├── docs/
│   └── function_io.md         # 函數 I/O 文件
├── goal/
│   └── goal.md                # 專案目標
├── run_automation.ps1         # PowerShell 自動化腳本
├── .env.example               # 環境變數範本
├── .env                       # 環境變數 (需自行建立)
└── cookies.json               # 登入 Cookie (自動生成)
```

## 🔧 疑難排解

### 驗證碼識別失敗

**症狀**: 連續 3 次無法識別驗證碼

**解決方案**:
1. 確認 Gemini API Key 正確
2. 檢查 API 配額是否用盡
3. 手動輸入驗證碼（系統會等待 30 秒）

### 登入失敗

**症狀**: 顯示 "登入失敗" 通知

**解決方案**:
1. 檢查 `.env` 中的帳號密碼是否正確
2. 確認網站可正常訪問
3. 刪除 `cookies.json` 強制重新登入

### Cookie 過期

**症狀**: 明明有 `cookies.json` 但仍需登入

**解決方案**:
- 正常情況，Cookie 會自動更新
- 如持續發生，請刪除 `cookies.json` 重新登入

### 排程未執行

**症狀**: Windows 排程設定後沒有自動執行

**解決方案**:
1. 確認排程權限正確（管理員）
2. 檢查 `scheduler.log` 查看錯誤訊息
3. 手動測試 PowerShell 腳本：
   ```powershell
   .\run_automation.ps1
   ```

## 📝 開發文件

- [Function I/O Documentation](docs/function_io.md) - 詳細的函數輸入輸出規格
- [Setup Scheduler Guide](SETUP_SCHEDULER.md) - Windows 排程設定教學
- [Diagnosis Report](diagnosis_report.md) - 登入問題診斷報告
- [Sign-in Fix Report](signin_fix_report.md) - 簽到功能修復報告

## 🧪 測試腳本

```bash
# 測試通知系統
node test_notification.js

# 測試抽獎功能
node test_lottery_feature.js
```

## ⚠️ 注意事項

1. **不要分享 .env 檔案** - 包含您的帳號密碼和 API Key
2. **不要提交 cookies.json** - 包含登入 Session
3. **定期檢查日誌** - 確保自動化正常運作
4. **API 配額** - Gemini API 有免費額度限制

## 🔒 安全性

- ✅ 敏感資訊儲存於 `.env`（已加入 `.gitignore`）
- ✅ Cookie 不會提交至版本控制
- ✅ 日誌檔案已排除於 Git
- ✅ 原始碼中無硬編碼的帳號密碼

## 📜 授權

MIT License - 詳見 [LICENSE](LICENSE)

## 🤝 貢獻

歡迎提交 Issue 或 Pull Request！

## 📞 聯絡方式

如有問題或建議，請開 Issue 討論。

---

**免責聲明**: 本專案僅供學習與個人使用。請遵守網站服務條款，避免過度頻繁請求。
