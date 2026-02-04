# UMA Daily Gift Automation Runner
# For use with Windows Task Scheduler
# 
# This script wraps the automation execution with error handling and logging

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir "logs\scheduler.log"

# Ensure logs directory exists
$LogDir = Join-Path $ScriptDir "logs"
if (!(Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

# Log function
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Add-Content -Path $LogFile -Value $LogMessage
    Write-Host $LogMessage
}

try {
    Write-Log "========================================"
    Write-Log "Starting UMA Daily Gift Automation"
    Write-Log "========================================"
    
    # Change to script directory
    Set-Location $ScriptDir
    Write-Log "Working directory: $ScriptDir"
    
    # Check if Node.js is available
    try {
        $nodeVersion = node --version
        Write-Log "Node.js version: $nodeVersion"
    } catch {
        Write-Log "ERROR: Node.js is not installed or not in PATH"
        throw "Node.js not found"
    }
    
    # Check if automation script exists
    $AutomationScript = Join-Path $ScriptDir "src\automation.js"
    if (!(Test-Path $AutomationScript)) {
        Write-Log "ERROR: automation.js not found at $AutomationScript"
        throw "Automation script not found"
    }
    
    # Run automation
    Write-Log "Executing automation script..."
    $StartTime = Get-Date
    
    node src/automation.js
    
    $EndTime = Get-Date
    $Duration = ($EndTime - $StartTime).TotalSeconds
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "✅ Automation completed successfully (Duration: $([math]::Round($Duration, 2))s)"
    } else {
        Write-Log "⚠️ Automation exited with code: $LASTEXITCODE"
    }
    
} catch {
    Write-Log "❌ ERROR: $_"
    Write-Log "Stack trace: $($_.ScriptStackTrace)"
    
    # Optional: Send Windows notification on error
    try {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "自動化執行失敗: $_",
            "UMA 每日禮物 - 排程錯誤",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    } catch {
        Write-Log "Failed to send error notification"
    }
    
    exit 1
    
} finally {
    Write-Log "========================================"
    Write-Log "Automation session ended"
    Write-Log "========================================`n"
}
