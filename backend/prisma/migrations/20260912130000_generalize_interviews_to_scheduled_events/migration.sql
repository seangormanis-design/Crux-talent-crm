-- Generalize the Interview model into a shared ScheduledEvent model, used
-- by both candidate interviews (jobCandidateId) and BD Opportunity meetings
-- (opportunityId + contactId). Renames rather than drop/recreate so the
-- existing interview rows are preserved.

-- RenameTable
ALTER TABLE "interviews" RENAME TO "scheduled_events";

-- RenameEnum
ALTER TYPE "InterviewFormat" RENAME TO "ScheduledEventFormat";

-- AlterTable: jobCandidateId is now optional (an event belongs to either a
-- JobCandidate or an Opportunity, never both), plus the two new columns.
ALTER TABLE "scheduled_events" ALTER COLUMN "jobCandidateId" DROP NOT NULL;
ALTER TABLE "scheduled_events" ADD COLUMN "opportunityId" TEXT;
ALTER TABLE "scheduled_events" ADD COLUMN "contactId" TEXT;

-- RenameConstraints/Indexes to match the new table name
ALTER TABLE "scheduled_events" RENAME CONSTRAINT "interviews_pkey" TO "scheduled_events_pkey";
ALTER TABLE "scheduled_events" RENAME CONSTRAINT "interviews_jobCandidateId_fkey" TO "scheduled_events_jobCandidateId_fkey";
ALTER INDEX "interviews_jobCandidateId_idx" RENAME TO "scheduled_events_jobCandidateId_idx";
ALTER INDEX "interviews_scheduledAt_idx" RENAME TO "scheduled_events_scheduledAt_idx";

-- AddForeignKey
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scheduled_events" ADD CONSTRAINT "scheduled_events_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "scheduled_events_opportunityId_idx" ON "scheduled_events"("opportunityId");
CREATE INDEX "scheduled_events_contactId_idx" ON "scheduled_events"("contactId");
