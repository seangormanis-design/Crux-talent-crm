# Crux Talent CRM — automated Postgres backup.
# Runs a pg_dump of the crux-postgres Docker container to a timestamped .sql
# file in $BackupDir (local), then copies that same file to $CloudBackupDir
# (Google Drive) for an off-machine copy, then prunes old local backups:
# keep every run for BACKUP_RETENTION_DAYS, collapse anything older to one
# backup per day. The cloud copy is best-effort — if Google Drive isn't
# mounted/running when this runs, the local backup still succeeds and a
# warning is written rather than failing the whole run.
#
# Intended to be run every 4 hours by a Windows Scheduled Task
# (see register-backup-task.ps1).

param(
  [string]$BackupDir = (Join-Path $PSScriptRoot "..\backups"),
  [string]$CloudBackupDir = "G:\My Drive\CRUX",
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
        "BACKUP_CLOUD_DIR" { $CloudBackupDir = $matches[2] }
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

# Off-machine copy: best-effort, since Google Drive may not be mounted at
# every 4-hourly run (e.g. not yet started after login) — a missing/failed
# cloud copy is logged loudly but never fails the run, since the local
# backup above already succeeded and is what retention/restore rely on.
try {
  if (Test-Path (Split-Path $CloudBackupDir -Parent)) {
    New-Item -ItemType Directory -Force -Path $CloudBackupDir | Out-Null
    Copy-Item -Path $backupFile -Destination $CloudBackupDir -Force
    Write-Output "Copied to cloud: $(Join-Path $CloudBackupDir (Split-Path $backupFile -Leaf))"
  } else {
    Write-Warning "Cloud backup skipped: '$CloudBackupDir' isn't reachable (is Google Drive running?)."
  }
} catch {
  Write-Warning "Cloud backup copy failed: $($_.Exception.Message)"
}

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
