-- CreateEnum
CREATE TYPE "InterviewFormat" AS ENUM ('PHONE', 'VIDEO', 'FACE_TO_FACE');

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "jobCandidateId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "format" "InterviewFormat" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interviews_jobCandidateId_idx" ON "interviews"("jobCandidateId");

-- CreateIndex
CREATE INDEX "interviews_scheduledAt_idx" ON "interviews"("scheduledAt");

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobCandidateId_fkey" FOREIGN KEY ("jobCandidateId") REFERENCES "job_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

