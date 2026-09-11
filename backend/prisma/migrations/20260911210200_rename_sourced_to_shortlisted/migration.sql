-- Rename the CandidateStage enum value SOURCED -> SHORTLISTED.
-- ALTER TYPE ... RENAME VALUE relabels the value in place, so every
-- existing job_candidates.stage row currently SOURCED reads as
-- SHORTLISTED afterwards — no data migration needed for that column.
ALTER TYPE "CandidateStage" RENAME VALUE 'SOURCED' TO 'SHORTLISTED';

-- stage_changes.fromStage/toStage are plain text columns (not enum-typed),
-- so the rename above doesn't touch them — update the historical values
-- directly so stage-change history reads consistently with the new name.
UPDATE "stage_changes" SET "fromStage" = 'SHORTLISTED' WHERE "fromStage" = 'SOURCED';
UPDATE "stage_changes" SET "toStage" = 'SHORTLISTED' WHERE "toStage" = 'SOURCED';
