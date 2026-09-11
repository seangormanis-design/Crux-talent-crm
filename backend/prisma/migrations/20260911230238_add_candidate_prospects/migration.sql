-- CreateTable
CREATE TABLE "candidate_prospects" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sourceJobId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reachedStage" "CandidateStage" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "candidate_prospects_candidateId_idx" ON "candidate_prospects"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_prospects_candidateId_sourceJobId_key" ON "candidate_prospects"("candidateId", "sourceJobId");

-- AddForeignKey
ALTER TABLE "candidate_prospects" ADD CONSTRAINT "candidate_prospects_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_prospects" ADD CONSTRAINT "candidate_prospects_sourceJobId_fkey" FOREIGN KEY ("sourceJobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_prospects" ADD CONSTRAINT "candidate_prospects_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
