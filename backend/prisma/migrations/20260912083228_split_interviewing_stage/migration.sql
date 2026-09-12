-- Split the CandidateStage value INTERVIEWING into FIRST_INTERVIEW and
-- FURTHER_INTERVIEWS. Postgres can't remove an enum value in place, so the
-- type is recreated with the new value set and every column using it is
-- swapped over. Existing INTERVIEWING rows map to FIRST_INTERVIEW — the
-- conservative default; recruiters can advance them to Further Interviews
-- manually if they were actually further along.

-- 1. New enum type with the final value set.
CREATE TYPE "CandidateStage_new" AS ENUM ('SHORTLISTED', 'CV_SENT', 'REJECTED', 'FIRST_INTERVIEW', 'FURTHER_INTERVIEWS', 'OFFERED', 'PLACED');

-- 2. Swap job_candidates.stage over via a mapped cast, preserving the index/default.
DROP INDEX "job_candidates_stage_idx";
ALTER TABLE "job_candidates"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE "CandidateStage_new" USING (
    CASE "stage"::text
      WHEN 'INTERVIEWING' THEN 'FIRST_INTERVIEW'
      ELSE "stage"::text
    END
  )::"CandidateStage_new",
  ALTER COLUMN "stage" SET DEFAULT 'SHORTLISTED';
CREATE INDEX "job_candidates_stage_idx" ON "job_candidates"("stage");

-- 3. Same swap for candidate_prospects.reachedStage (also CandidateStage-typed).
ALTER TABLE "candidate_prospects"
  ALTER COLUMN "reachedStage" TYPE "CandidateStage_new" USING (
    CASE "reachedStage"::text
      WHEN 'INTERVIEWING' THEN 'FIRST_INTERVIEW'
      ELSE "reachedStage"::text
    END
  )::"CandidateStage_new";

-- 4. Drop the old type, rename the new one into its place.
DROP TYPE "CandidateStage";
ALTER TYPE "CandidateStage_new" RENAME TO "CandidateStage";

-- 5. stage_changes.fromStage/toStage are plain text columns (not enum-typed)
-- — update the historical values directly so stage-change history stays
-- consistent with the new names.
UPDATE "stage_changes" SET "fromStage" = 'FIRST_INTERVIEW' WHERE "fromStage" = 'INTERVIEWING';
UPDATE "stage_changes" SET "toStage" = 'FIRST_INTERVIEW' WHERE "toStage" = 'INTERVIEWING';
