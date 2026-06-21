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

# Ensure node_modules is installed
$NodeModulesPath = Join-Path $ScriptDir "node_modules"
if (!(Test-Path $NodeModulesPath)) {
    Write-Host "node_modules not found. Installing dependencies..."
    Set-Location $ScriptDir
    npm install
    npx playwright install
}

# Log function
function Write-Log {
    param([string]$Message)
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Add-Content -Path $LogFile -Value $LogMessage
    Write-Host $LogMessage
}

function Invoke-AutomationStep {
    param(
        [string]$Name,
        [string]$ScriptPath,
        [string[]]$Arguments = @()
    )

    if (!(Test-Path (Join-Path $ScriptDir $ScriptPath))) {
        Write-Log "ERROR: $Name script not found at $ScriptPath"
        return [PSCustomObject]@{
            Name = $Name
            ExitCode = 1
            Duration = 0
        }
    }

    Write-Log "----------------------------------------"
    Write-Log "Starting $Name"
    Write-Log "Executing: node $ScriptPath $($Arguments -join ' ')"
    $StartTime = Get-Date

    $NodeOutput = & node $ScriptPath @Arguments 2>&1
    $StepExitCode = $LASTEXITCODE
    foreach ($Line in $NodeOutput) {
        if ($null -ne $Line -and "$Line".Length -gt 0) {
            Write-Log "[$Name] $Line"
        }
    }

    $EndTime = Get-Date
    $Duration = ($EndTime - $StartTime).TotalSeconds

    if ($StepExitCode -eq 0) {
        Write-Log "$Name completed successfully (Duration: $([math]::Round($Duration, 2))s)"
    } else {
        Write-Log "$Name exited with code: $StepExitCode (Duration: $([math]::Round($Duration, 2))s)"
    }

    return [PSCustomObject]@{
        Name = $Name
        ExitCode = $StepExitCode
        Duration = $Duration
    }
}

try {
    Write-Log "========================================"
    Write-Log "Starting UMA scheduled automations"
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
    
    $FailedSteps = @()

    $Result = Invoke-AutomationStep -Name "UMA Daily Gift" -ScriptPath "src/automation.js"
    if ($Result.ExitCode -ne 0) {
        $FailedSteps += $Result
    }

    $Result = Invoke-AutomationStep -Name "UMA Match Tasks" -ScriptPath "src/umamatchAutomation.js" -Arguments @("--claim")
    if ($Result.ExitCode -ne 0) {
        $FailedSteps += $Result
    }

    if ($FailedSteps.Count -gt 0) {
        $FailedNames = ($FailedSteps | ForEach-Object { "$($_.Name) (exit $($_.ExitCode))" }) -join ", "
        throw "One or more automation steps failed: $FailedNames"
    }

    Write-Log "All automation steps completed successfully."
    
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
