-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "needsTermsSetup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "company_terms" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "feeStructurePercentage" DECIMAL(5,2),
    "feeExceptions" TEXT,
    "paymentTerms" TEXT,
    "invoicingContactId" TEXT,
    "specialTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_terms_companyId_key" ON "company_terms"("companyId");

-- AddForeignKey
ALTER TABLE "company_terms" ADD CONSTRAINT "company_terms_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_terms" ADD CONSTRAINT "company_terms_invoicingContactId_fkey" FOREIGN KEY ("invoicingContactId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;
