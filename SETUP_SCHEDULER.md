# Windows Task Scheduler Setup Guide

本指南將教您如何設定 Windows 工作排程器，讓自動化腳本每天自動執行。

## 📋 前置準備

1. ✅ 已完成專案安裝（參見 [README.md](README.md)）
2. ✅ `.env` 檔案已設定完成
3. ✅ 手動測試過自動化腳本可正常執行

## 🛠️ 設定步驟

### 步驟 1: 開啟工作排程器

1. 按下 `Win + R` 開啟「執行」對話框
2. 輸入 `taskschd.msc` 並按 Enter
3. 工作排程器視窗會開啟

### 步驟 2: 建立基本工作

1. 在右側「動作」面板中，點擊 **建立基本工作**
2. 填入以下資訊：
   - **名稱**: `UMA Daily Gift Automation`
   - **描述**: `自動領取 UMA 每日簽到獎勵`
3. 點擊「下一步」

### 步驟 3: 設定觸發程序

1. 選擇 **每天**
2. 點擊「下一步」
3. 設定開始時間:
   - **開始**: 選擇今天的日期
   - **時間**: `09:00:00`（建議上午 9 點）
   - **每隔**: `1` 天
4. 點擊「下一步」

### 步驟 4: 設定動作

1. 選擇 **啟動程式**
2. 點擊「下一步」
3. 填入以下資訊：
   - **程式或指令碼**: `powershell.exe`
   - **新增引數**: 
     ```
     -ExecutionPolicy Bypass -File "D:\Workspace\Github\TW_uma_dailygift\run_automation.ps1"
     ```
     ⚠️ **請將路徑改為您的實際專案路徑**
   
   - **開始於**: 
     ```
     D:\Workspace\Github\TW_uma_dailygift
     ```
     ⚠️ **請將路徑改為您的實際專案路徑**

4. 點擊「下一步」

### 步驟 5: 完成設定

1. 勾選 **當按一下完成時，開啟此工作的內容對話方塊**
2. 點擊「完成」

### 步驟 6: 進階設定（重要！）

內容對話框會自動開啟，進行以下設定：

#### 一般 (General) 頁籤

1. 勾選 **以最高權限執行**
2. 設定 **執行身分**: 選擇您的使用者帳戶
3. 勾選 **不論使用者登入與否均執行**（如果希望登出後也執行）

#### 觸發程序 (Triggers) 頁籤

1. 選擇您建立的觸發程序
2. 點擊「編輯」
3. 在「進階設定」中：
   - 勾選 **已啟用**
   - **延遲工作最多隨機延遲時間**: 建議設為 `PT30M`（30 分鐘）以避免整點流量過高

#### 條件 (Conditions) 頁籤

1. **電源**:
   - ✅ 如果是筆記型電腦，取消勾選「只在電腦使用 AC 電源時才啟動工作」
   - ✅ 取消勾選「如果電腦改用電池電源，停止工作」

2. **網路**:
   - ✅ 勾選「只有在下列網路連線可用時才啟動」
   - ✅ 選擇「任何連線」

#### 設定 (Settings) 頁籤

1. ✅ 勾選「如果工作失敗，依下列時間間隔重新啟動」
   - 間隔: `1 分鐘`
   - 嘗試重新啟動最多: `3` 次

2. ✅ 取消勾選「如果工作執行超過下列期間，停止工作」

3. ✅ 勾選「不啟動新的執行個體」於「如果工作已在執行，則適用下列規則」

4. 點擊「確定」保存設定

## ✅ 驗證設定

### 測試立即執行

1. 在工作排程器中找到 `UMA Daily Gift Automation`
2. 右鍵點擊 → **執行**
3. 查看 `logs/scheduler.log` 確認執行狀況

### 檢查日誌

```powershell
# 查看排程器日誌
Get-Content logs\scheduler.log -Tail 50

# 查看每日摘要
Get-Content logs\daily-summary.log -Tail 30
```

## 🔧 疑難排解

### 問題 1: 排程未執行

**可能原因**:
- 電腦在排程時間關機
- 電腦在睡眠/休眠狀態
- 使用者未登入（需勾選「不論使用者登入與否均執行」）

**解決方案**:
1. 確認電腦在排程時間開機
2. 在「條件」頁籤中勾選「喚醒電腦以執行此工作」
3. 查看 `logs/scheduler.log` 獲取詳細錯誤訊息

### 問題 2: PowerShell 執行政策錯誤

**錯誤訊息**: `無法載入檔案，因為這個系統上已停用指令碼執行`

**解決方案**:
```powershell
# 以管理員身分執行 PowerShell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

或在排程引數中確保有 `-ExecutionPolicy Bypass`

### 問題 3: 找不到 Node.js

**錯誤訊息**: `Node.js is not installed or not in PATH`

**解決方案**:
1. 確認 Node.js 已安裝
2. 確認環境變數 PATH 包含 Node.js 路徑
3. 在排程「動作」中手動指定完整路徑:
   ```
   程式: C:\Program Files\nodejs\node.exe
   引數: "D:\Workspace\Github\TW_uma_dailygift\src\automation.js"
   開始於: D:\Workspace\Github\TW_uma_dailygift
   ```

### 問題 4: 權限不足

**解決方案**:
1. 確認已勾選「以最高權限執行」
2. 確認執行身分為您的使用者帳戶
3. 右鍵點擊 `run_automation.ps1` → 內容 → 解除封鎖

## 📊 監控與維護

### 查看執行歷程記錄

1. 在工作排程器中選擇工作
2. 點擊下方「歷程記錄」頁籤
3. 可查看所有執行記錄與結果

### 定期檢查

建議每週檢查一次日誌檔案，確保：
- ✅ 簽到成功
- ✅ 沒有重複錯誤
- ✅ Cookie 正常更新

### 手動觸發測試

```powershell
# 切換至專案目錄
cd D:\Workspace\Github\TW_uma_dailygift

# 手動執行 PowerShell 腳本
.\run_automation.ps1

# 或直接執行 Node.js 腳本
node src/automation.js
```

## 📅 建議排程時間

| 時間 | 優點 | 缺點 |
|------|------|------|
| 09:00 | 早上執行，及早領取獎勵 | 可能流量較高 |
| 12:00 | 午休時間，電腦通常開機 | 可能忘記開機 |
| 14:00 | 下午時段，流量穩定 | - |
| 22:00 | 晚間時段，確保當天簽到 | 可能電腦已關機 |

**推薦**: 09:00 或 14:00

## 🔔 通知設定

執行失敗時，PowerShell 腳本會自動彈出通知視窗。

如果不需要通知，可編輯 `run_automation.ps1`，將以下程式碼區塊註解:

```powershell
# Optional: Send Windows notification on error
try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(...)
} catch {
    Write-Log "Failed to send error notification"
}
```

## 📝 其他資源

- [Windows Task Scheduler 官方文件](https://docs.microsoft.com/en-us/windows/win32/taskschd/task-scheduler-start-page)
- [PowerShell ExecutionPolicy 說明](https://docs.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies)

---

**完成設定後**，您的自動化腳本將每天定時執行，無需手動干預！ 🎉
