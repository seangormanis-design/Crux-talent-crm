-- Feature 1: the 7-section Qualification Call template, one nullable
-- column per section — NULL for every non-QUALIFICATION_CALL row, and NULL
-- on historical Qualification Call rows too (deliberately not backfilled;
-- notes stays their only record of what was captured).
-- Feature 3: edit tracking for the one deliberate exception to interactions
-- being append-only.
ALTER TABLE "interactions"
  ADD COLUMN "qcPresent" TEXT,
  ADD COLUMN "qcPast" TEXT,
  ADD COLUMN "qcFuture" TEXT,
  ADD COLUMN "qcAob" TEXT,
  ADD COLUMN "qcThreats" TEXT,
  ADD COLUMN "qcLeads" TEXT,
  ADD COLUMN "qcPersonalInfo" TEXT,
  ADD COLUMN "editedAt" TIMESTAMP(3),
  ADD COLUMN "editedById" TEXT;

ALTER TABLE "interactions"
  ADD CONSTRAINT "interactions_editedById_fkey"
  FOREIGN KEY ("editedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
