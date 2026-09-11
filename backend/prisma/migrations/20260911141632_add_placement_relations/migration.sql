-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placements" ADD CONSTRAINT "placements_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
