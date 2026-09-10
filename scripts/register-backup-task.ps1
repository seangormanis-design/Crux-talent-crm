# Registers (or updates) a Windows Scheduled Task that runs backup.ps1 every
# 4 hours, indefinitely, as the current user. Safe to re-run — it replaces
# any existing task of the same name.
#
# Usage: .\scripts\register-backup-task.ps1

$ErrorActionPreference = "Stop"

$taskName = "CruxTalentCRM-Backup"
$scriptPath = (Resolve-Path (Join-Path $PSScriptRoot "backup.ps1")).Path

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Task Scheduler's XML schema rejects [TimeSpan]::MaxValue as a duration, so
# use a long-but-valid duration (10 years) as a practical stand-in for "forever".
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Hours 4) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Write-Output "Scheduled task '$taskName' registered: runs backup.ps1 every 4 hours."
Write-Output "It only succeeds while Docker Desktop and the crux-postgres container are running."
Write-Output "View/manage it in Task Scheduler, or run: Get-ScheduledTask -TaskName '$taskName'"
