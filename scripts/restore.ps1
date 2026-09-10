# Crux Talent CRM — restore a database backup produced by backup.ps1.
#
# Usage:
#   .\scripts\restore.ps1 -BackupFile ".\backups\crux-crm-backup-2026-09-10-1200.sql"
#
# WARNING: this replaces all data in the target database. Take a fresh backup
# first if you want to keep current state as a fallback.

param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ContainerName = "crux-postgres",
  [string]$DbUser = "crux",
  [string]$DbName = "crux_crm",
  [string]$DbPassword = "cruxpassword"
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
      }
    }
  }
}

if (-not (Test-Path $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
  exit 1
}

Write-Output "This will OVERWRITE all data in database '$DbName' with the contents of:"
Write-Output "  $BackupFile"
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne "YES") {
  Write-Output "Aborted."
  exit 0
}

$resolvedPath = (Resolve-Path $BackupFile).Path
$cmd = "docker exec -i -e PGPASSWORD=$DbPassword $ContainerName psql -U $DbUser -d $DbName < `"$resolvedPath`""
cmd /c $cmd

if ($LASTEXITCODE -ne 0) {
  Write-Error "Restore failed (exit code $LASTEXITCODE). Check the container is running and the file is a valid pg_dump."
  exit 1
}

Write-Output "Restore complete."
