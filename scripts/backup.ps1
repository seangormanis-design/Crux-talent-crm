# Crux Talent CRM — automated Postgres backup.
# Runs a pg_dump of the crux-postgres Docker container to a timestamped .sql
# file, then prunes old backups: keep every run for BACKUP_RETENTION_DAYS,
# collapse anything older to one backup per day.
#
# Intended to be run every 4 hours by a Windows Scheduled Task
# (see register-backup-task.ps1) — the backup folder lives inside this
# project's OneDrive-synced directory, so every backup also syncs to
# Sean's personal OneDrive automatically, with no manual step.

param(
  [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups"),
  [string]$ContainerName = "crux-postgres",
  [string]$DbUser = "crux",
  [string]$DbName = "crux_crm",
  [string]$DbPassword = "cruxpassword",
  [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      switch ($matches[1]) {
        "POSTGRES_USER" { $DbUser = $matches[2] }
        "POSTGRES_DB" { $DbName = $matches[2] }
        "POSTGRES_PASSWORD" { $DbPassword = $matches[2] }
        "BACKUP_RETENTION_DAYS" { $RetentionDays = [int]$matches[2] }
      }
    }
  }
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$backupFile = Join-Path $BackupDir "crux-crm-backup-$timestamp.sql"

$running = docker ps --filter "name=$ContainerName" --format "{{.Names}}" 2>$null
if (-not $running) {
  Write-Error "Container '$ContainerName' is not running - start it with 'docker compose up -d' before backups can run."
  exit 1
}

Write-Output "Backing up '$DbName' from container '$ContainerName' to $backupFile ..."

# Redirect via cmd so the dump is written as raw bytes (no PowerShell-added
# BOM, which psql can choke on when restoring).
$cmd = "docker exec -e PGPASSWORD=$DbPassword $ContainerName pg_dump -U $DbUser -d $DbName --no-owner --format=plain > `"$backupFile`""
cmd /c $cmd
$dumpExitCode = $LASTEXITCODE

if ($dumpExitCode -ne 0 -or -not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
  Write-Error "pg_dump failed or produced an empty file (exit code $dumpExitCode)."
  Remove-Item $backupFile -Force -ErrorAction SilentlyContinue
  exit 1
}

$sizeKb = [math]::Round((Get-Item $backupFile).Length / 1KB, 1)
Write-Output "Backup written: $backupFile ($sizeKb KB)"

# Retention: keep every 4-hourly backup for the last $RetentionDays days;
# beyond that, keep only the earliest backup of each day.
$cutoff = (Get-Date).AddDays(-$RetentionDays)
$allBackups = Get-ChildItem -Path $BackupDir -Filter "crux-crm-backup-*.sql" | Sort-Object LastWriteTime

$old = $allBackups | Where-Object { $_.LastWriteTime -lt $cutoff }
$keepPerDay = $old | Group-Object { $_.LastWriteTime.Date } | ForEach-Object { ($_.Group | Sort-Object LastWriteTime | Select-Object -First 1).FullName }

foreach ($file in $old) {
  if ($keepPerDay -notcontains $file.FullName) {
    Write-Output "Pruning old backup: $($file.Name)"
    Remove-Item $file.FullName -Force
  }
}
