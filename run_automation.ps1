# UMA Daily Gift Automation Runner
# For use with Windows Task Scheduler
# 
# This script wraps setup and automation execution with error handling and logging

param(
    [switch]$Setup,
    [switch]$ConfigureEnv,
    [switch]$InstallScheduler
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $ScriptDir "logs\scheduler.log"
$EnvFile = Join-Path $ScriptDir ".env"
$EnvExampleFile = Join-Path $ScriptDir ".env.example"
$RequiredConfigNames = @("login_username", "login_password", "GEMINI_API_KEY")

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

function Add-UiAssemblies {
    if (-not [Environment]::UserInteractive) {
        throw "Setup UI requires an interactive Windows session."
    }

    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName Microsoft.VisualBasic
}

function Show-UiMessage {
    param(
        [string]$Message,
        [string]$Title = "UMA Daily Gift Automation",
        [System.Windows.Forms.MessageBoxIcon]$Icon = [System.Windows.Forms.MessageBoxIcon]::Information
    )

    Add-UiAssemblies
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        $Icon
    ) | Out-Null
}

function Confirm-Ui {
    param(
        [string]$Message,
        [string]$Title = "UMA Daily Gift Automation"
    )

    Add-UiAssemblies
    $Result = [System.Windows.Forms.MessageBox]::Show(
        $Message,
        $Title,
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    return $Result -eq [System.Windows.Forms.DialogResult]::Yes
}

function Read-UiText {
    param(
        [string]$Prompt,
        [string]$Title,
        [string]$DefaultValue = "",
        [switch]$Required
    )

    Add-UiAssemblies
    $Value = [Microsoft.VisualBasic.Interaction]::InputBox($Prompt, $Title, $DefaultValue)
    if ($Required -and [string]::IsNullOrWhiteSpace($Value)) {
        throw "Required value was not provided: $Title"
    }

    return $Value.Trim()
}

function Read-UiSecret {
    param(
        [string]$Prompt,
        [string]$Title,
        [string]$DefaultValue = "",
        [switch]$Required
    )

    Add-UiAssemblies

    $Form = New-Object System.Windows.Forms.Form
    $Form.Text = $Title
    $Form.Width = 520
    $Form.Height = 170
    $Form.StartPosition = "CenterScreen"
    $Form.FormBorderStyle = "FixedDialog"
    $Form.MaximizeBox = $false
    $Form.MinimizeBox = $false

    $Label = New-Object System.Windows.Forms.Label
    $Label.Text = $Prompt
    $Label.Left = 12
    $Label.Top = 15
    $Label.Width = 480
    $Form.Controls.Add($Label)

    $TextBox = New-Object System.Windows.Forms.TextBox
    $TextBox.Left = 12
    $TextBox.Top = 45
    $TextBox.Width = 480
    $TextBox.UseSystemPasswordChar = $true
    $TextBox.Text = $DefaultValue
    $Form.Controls.Add($TextBox)

    $OkButton = New-Object System.Windows.Forms.Button
    $OkButton.Text = "OK"
    $OkButton.Left = 315
    $OkButton.Top = 85
    $OkButton.Width = 80
    $OkButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $Form.AcceptButton = $OkButton
    $Form.Controls.Add($OkButton)

    $CancelButton = New-Object System.Windows.Forms.Button
    $CancelButton.Text = "Cancel"
    $CancelButton.Left = 410
    $CancelButton.Top = 85
    $CancelButton.Width = 80
    $CancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $Form.CancelButton = $CancelButton
    $Form.Controls.Add($CancelButton)

    if ($Form.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw "Input was cancelled: $Title"
    }

    if ($Required -and [string]::IsNullOrWhiteSpace($TextBox.Text)) {
        throw "Required value was not provided: $Title"
    }

    return $TextBox.Text
}

function Read-EnvFileValues {
    param([string]$Path)

    $Values = @{}
    if (!(Test-Path $Path)) {
        return $Values
    }

    foreach ($Line in Get-Content $Path) {
        if ($Line -match '^\s*([^#][^=]+?)=(.*)$') {
            $Values[$Matches[1].Trim()] = $Matches[2]
        }
    }

    return $Values
}

function Get-EnvValue {
    param(
        [hashtable]$Values,
        [string]$Name,
        [string]$DefaultValue = ""
    )

    if ($Values.ContainsKey($Name) -and -not [string]::IsNullOrEmpty($Values[$Name])) {
        return $Values[$Name]
    }

    return $DefaultValue
}

function Get-EffectiveConfigValue {
    param(
        [hashtable]$FileValues,
        [string]$Name
    )

    $EnvironmentValue = [Environment]::GetEnvironmentVariable($Name, "Process")
    if (-not [string]::IsNullOrWhiteSpace($EnvironmentValue)) {
        return $EnvironmentValue
    }

    return Get-EnvValue -Values $FileValues -Name $Name
}

function Get-MissingRequiredConfigNames {
    param([hashtable]$FileValues)

    $MissingNames = @()
    foreach ($Name in $RequiredConfigNames) {
        $Value = Get-EffectiveConfigValue -FileValues $FileValues -Name $Name
        if ([string]::IsNullOrWhiteSpace($Value)) {
            $MissingNames += $Name
        }
    }

    return $MissingNames
}

function Ensure-RequiredConfiguration {
    $FileValues = Read-EnvFileValues -Path $EnvFile
    $MissingNames = @(Get-MissingRequiredConfigNames -FileValues $FileValues)
    if ($MissingNames.Count -eq 0) {
        return
    }

    $MissingText = $MissingNames -join ", "
    Write-Log "Required configuration missing: $MissingText"

    if (-not [Environment]::UserInteractive) {
        throw "Required configuration missing: $MissingText. Run .\run_automation.ps1 -ConfigureEnv in an interactive session, or provide these values as environment variables."
    }

    Show-UiMessage -Title "Configuration required" -Message "Required configuration is missing: $MissingText`n`nThe .env setup wizard will open now."
    Set-EnvFileFromUi

    $FileValues = Read-EnvFileValues -Path $EnvFile
    $MissingNames = @(Get-MissingRequiredConfigNames -FileValues $FileValues)
    if ($MissingNames.Count -gt 0) {
        throw "Required configuration still missing after setup: $($MissingNames -join ', ')"
    }
}

function Set-EnvFileFromUi {
    Add-UiAssemblies

    $ExistingValues = Read-EnvFileValues -Path $EnvFile
    $TemplateValues = Read-EnvFileValues -Path $EnvExampleFile

    if ((Test-Path $EnvFile) -and -not (Confirm-Ui -Title ".env already exists" -Message ".env already exists. Do you want to update it with the setup wizard?")) {
        return
    }

    $UsernameDefault = Get-EnvValue -Values $ExistingValues -Name "login_username" -DefaultValue (Get-EnvValue -Values $TemplateValues -Name "login_username")
    $PasswordDefault = Get-EnvValue -Values $ExistingValues -Name "login_password"
    $GeminiDefault = Get-EnvValue -Values $ExistingValues -Name "GEMINI_API_KEY"
    $ModelDefault = Get-EnvValue -Values $ExistingValues -Name "model" -DefaultValue (Get-EnvValue -Values $TemplateValues -Name "model" -DefaultValue "gemini-3-flash-preview")
    $SunsetDefault = Get-EnvValue -Values $ExistingValues -Name "UMAMATCH_SUNSET_AT" -DefaultValue (Get-EnvValue -Values $TemplateValues -Name "UMAMATCH_SUNSET_AT" -DefaultValue "2026-07-06T04:59:00+08:00")
    $TaskSunsetDefault = Get-EnvValue -Values $ExistingValues -Name "UMAMATCH_TASK_SUNSET_AT" -DefaultValue (Get-EnvValue -Values $TemplateValues -Name "UMAMATCH_TASK_SUNSET_AT" -DefaultValue "2026-06-29T04:59:00+08:00")

    $Username = Read-UiText -Title "UMA login username" -Prompt "Enter login_username for uma.komoejoy.com:" -DefaultValue $UsernameDefault -Required
    $Password = Read-UiSecret -Title "UMA login password" -Prompt "Enter login_password for uma.komoejoy.com:" -DefaultValue $PasswordDefault -Required
    $GeminiApiKey = Read-UiSecret -Title "Gemini API key" -Prompt "Enter GEMINI_API_KEY:" -DefaultValue $GeminiDefault -Required
    $Model = Read-UiText -Title "Gemini model" -Prompt "Enter Gemini model name:" -DefaultValue $ModelDefault -Required
    $UmamatchSunsetAt = Read-UiText -Title "Umamatch sunset" -Prompt "Enter UMAMATCH_SUNSET_AT:" -DefaultValue $SunsetDefault -Required
    $UmamatchTaskSunsetAt = Read-UiText -Title "Umamatch task sunset" -Prompt "Enter UMAMATCH_TASK_SUNSET_AT:" -DefaultValue $TaskSunsetDefault -Required

    $Lines = @(
        "# UMA Login Credentials",
        "login_username=$Username",
        "login_password=$Password",
        "",
        "# Google Gemini API Key",
        "GEMINI_API_KEY=$GeminiApiKey",
        "model=$Model",
        "",
        "# UMA Match sunset controls",
        "UMAMATCH_SUNSET_AT=$UmamatchSunsetAt",
        "UMAMATCH_TASK_SUNSET_AT=$UmamatchTaskSunsetAt"
    )

    Set-Content -Path $EnvFile -Value $Lines -Encoding UTF8
    Show-UiMessage -Title ".env saved" -Message ".env has been written to:`n$EnvFile"
}

function Register-SchedulerTaskFromUi {
    Add-UiAssemblies

    $TaskName = Read-UiText -Title "Task Scheduler name" -Prompt "Enter the Windows Task Scheduler task name:" -DefaultValue "UMA Daily Gift Automation" -Required
    $StartTimeText = Read-UiText -Title "Daily start time" -Prompt "Enter the daily start time in HH:mm format:" -DefaultValue "09:00" -Required
    $StartTime = [TimeSpan]::Zero
    if (-not [TimeSpan]::TryParse($StartTimeText, [ref]$StartTime)) {
        throw "Invalid start time. Use HH:mm, for example 09:00."
    }

    $RunHighest = Confirm-Ui -Title "Run level" -Message "Run the scheduled task with highest available privileges?"
    $WakeToRun = Confirm-Ui -Title "Wake computer" -Message "Wake the computer to run this task when possible?"
    $RunLevel = if ($RunHighest) { "Highest" } else { "Limited" }
    $ScriptPath = Join-Path $ScriptDir "run_automation.ps1"
    $Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    $At = (Get-Date).Date.Add($StartTime)

    $Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $Arguments -WorkingDirectory $ScriptDir
    $Trigger = New-ScheduledTaskTrigger -Daily -At $At
    if ($WakeToRun) {
        $Settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable -WakeToRun -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    } else {
        $Settings = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    }
    $Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel $RunLevel

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Description "Runs UMA daily gift and umamatch automation through run_automation.ps1." -Force | Out-Null
    Show-UiMessage -Title "Scheduled task registered" -Message "Windows Task Scheduler task has been registered:`n$TaskName"
}

function Show-SetupWizard {
    Add-UiAssemblies
    Show-UiMessage -Title "UMA setup wizard" -Message "This wizard helps create .env and register the Windows scheduled task. Normal automation still runs through run_automation.ps1 without -Setup."

    $RunEnvSetup = $ConfigureEnv -or (-not $InstallScheduler -and (Confirm-Ui -Title ".env setup" -Message "Create or update .env now?"))
    $RunSchedulerSetup = $InstallScheduler -or (-not $ConfigureEnv -and (Confirm-Ui -Title "Windows Task Scheduler" -Message "Register or update the Windows scheduled task now?"))

    if ($RunEnvSetup) {
        Set-EnvFileFromUi
    }

    if ($RunSchedulerSetup) {
        Register-SchedulerTaskFromUi
    }

    Show-UiMessage -Title "Setup complete" -Message "Setup wizard finished."
}

function Ensure-NodeDependencies {
    $NodeModulesPath = Join-Path $ScriptDir "node_modules"
    if (!(Test-Path $NodeModulesPath)) {
        Write-Host "node_modules not found. Installing dependencies..."
        Set-Location $ScriptDir
        npm install
        npx playwright install
    }
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

if ($Setup -or $ConfigureEnv -or $InstallScheduler) {
    try {
        Show-SetupWizard
        exit 0
    } catch {
        Write-Host "Setup failed: $_"
        try {
            Show-UiMessage -Title "Setup failed" -Message "Setup failed: $_" -Icon ([System.Windows.Forms.MessageBoxIcon]::Error)
        } catch {
            Write-Host "Failed to show setup error dialog."
        }
        exit 1
    }
}

Ensure-RequiredConfiguration
Ensure-NodeDependencies

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
