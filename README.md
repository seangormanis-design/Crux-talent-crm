# Crux Talent CRM

A bespoke CRM/ATS for Crux Talent, a specialist Microsoft (Dynamics 365, Power Platform, Data & AI) recruitment business. Phase 1: core CRM — Companies, People (Candidates/Client Contacts), Jobs, Pipeline, Documents, Interactions, Placements & Fees, manual search, dashboard.

## Stack

- Backend: Node.js + TypeScript, Express, Prisma (PostgreSQL)
- Frontend: React + TypeScript, Vite, Tailwind CSS
- Auth: email + password, bcrypt hashing, JWT
- File storage: local filesystem behind a storage abstraction (swap to S3-compatible later via env var)
- Local orchestration: Docker Compose (Postgres + backend + frontend)

## Monorepo layout

```
/backend    Express API, Prisma schema/migrations, seed script
/frontend   React app
/shared     TypeScript types/enums shared between backend and frontend
/scripts    Backup, restore, and scheduled-task registration scripts
```

## Local setup

1. Install Docker Desktop and Node.js 20+.
2. Copy the env file and adjust secrets:
   ```bash
   cp .env.example .env
   ```
3. Start Postgres, the API and the frontend:
   ```bash
   docker compose up -d --build
   ```
4. Run migrations and seed demo data:
   ```bash
   cd backend
   npm install
   npx prisma migrate deploy
   npm run seed
   ```
5. Open the app at http://localhost:5173. Log in with the seed user printed by the seed script (default `sean@cruxtalent.com` / `changeme123` unless overridden by `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` env vars).

### Running without Docker (dev mode)

```bash
npm install                      # installs all workspaces
npm run prisma:generate
npm run prisma:migrate           # requires DATABASE_URL pointing at a local Postgres
npm run seed
npm run dev:backend              # http://localhost:4000
npm run dev:frontend             # http://localhost:5173
```

## Database migrations

Every schema change goes through a Prisma migration — never edit the database by hand.

```bash
cd backend
npx prisma migrate dev --name <description>
```

## Backups

`scripts/backup.ps1` runs `pg_dump` against the `crux-postgres` Docker container to a timestamped file in `backups/` (inside this project folder), then prunes old backups: every run is kept for 7 days (`BACKUP_RETENTION_DAYS` in `.env`), older than that only the first backup of each day is kept.

Because this project folder lives inside your **personal** OneDrive (`C:\Users\seanhelloai\OneDrive\...`, not the work-tenant `OneDrive - Hello AI Collective Ltd`), every backup written to `backups/` syncs to your personal cloud storage automatically within minutes — no extra step needed. Do not move this project into a work-managed OneDrive/SharePoint location, since candidate PII would then live in employer-controlled infrastructure.

**Set up the 4-hourly schedule (Windows Task Scheduler — there's no native cron on Windows):**

```powershell
.\scripts\register-backup-task.ps1
```

This registers a task named `CruxTalentCRM-Backup` that runs `backup.ps1` every 4 hours for as long as your Windows account is on this machine. It only succeeds while Docker Desktop and the `crux-postgres` container are running. Manage it with:

```powershell
Get-ScheduledTask -TaskName "CruxTalentCRM-Backup"
Start-ScheduledTask -TaskName "CruxTalentCRM-Backup"   # run once, on demand
Unregister-ScheduledTask -TaskName "CruxTalentCRM-Backup" -Confirm:$false   # remove it
```

**Restore:**

```powershell
.\scripts\restore.ps1 -BackupFile ".\backups\crux-crm-backup-2026-09-10-1200.sql"
```

or directly with `psql`:

```bash
docker exec -i crux-postgres psql -U crux -d crux_crm < backups/crux-crm-backup-2026-09-10-1200.sql
```

Once migrated to a hosted Postgres provider (see below), retire this manual routine in favour of the provider's built-in backups — keep the personal-cloud-storage sync as a second safety net regardless.

## Migrating to a hosted Postgres (cloud) later

No architecture change is required — only configuration:

1. Provision a Postgres instance (Supabase, Railway, Render, etc.).
2. Point `DATABASE_URL` at the hosted instance.
3. Run `npx prisma migrate deploy` against it.
4. Deploy `backend` and `frontend` to your host of choice (containers build from the existing Dockerfiles).
5. If moving file storage off local disk, implement a new class against `backend/src/storage/StorageDriver.ts` (e.g. `S3StorageDriver`) and set `STORAGE_DRIVER=s3` — nothing else in the app changes.

## Out of scope for Phase 1

See the build spec: no LinkedIn scraping/automated intelligence, no automated GDPR erasure workflows, no multi-user permissions, no full invoicing system. The schema (`tags`/`custom_fields`, `StageChange` history, skills/motivations tagging) is deliberately built so these can be added later without restructuring.
