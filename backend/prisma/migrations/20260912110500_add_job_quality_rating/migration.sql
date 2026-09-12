-- CreateEnum
CREATE TYPE "JobQualityRating" AS ENUM ('A', 'B', 'C');

-- AlterTable: add nullable first so existing rows aren't broken...
ALTER TABLE "jobs" ADD COLUMN "qualityRating" "JobQualityRating";

-- ...backfill existing jobs with a neutral rating (there's no way to infer
-- the recruiter's real judgement retroactively, so this is a placeholder
-- the user should revisit, not a meaningful default)...
UPDATE "jobs" SET "qualityRating" = 'B' WHERE "qualityRating" IS NULL;

-- ...then enforce NOT NULL going forward, so every new Job must be rated.
ALTER TABLE "jobs" ALTER COLUMN "qualityRating" SET NOT NULL;

-- CreateIndex
CREATE INDEX "jobs_qualityRating_idx" ON "jobs"("qualityRating");
