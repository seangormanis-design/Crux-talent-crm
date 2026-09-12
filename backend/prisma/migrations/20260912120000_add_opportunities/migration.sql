-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('IDENTIFIED', 'RESEARCHED', 'CONTACTED', 'MEETING_BOOKED', 'PROPOSAL_SENT', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "interaction_intelligence" ADD COLUMN     "suggestedOpportunities" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'IDENTIFIED',
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "opportunities_companyId_idx" ON "opportunities"("companyId");

-- CreateIndex
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
