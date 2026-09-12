-- DropForeignKey
ALTER TABLE "opportunities" DROP CONSTRAINT "opportunities_companyId_fkey";

-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "targetContactId" TEXT,
ALTER COLUMN "personId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN     "prospectCompanyName" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "target_contacts" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "linkedinUrl" TEXT,
    "convertedPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "target_contacts_convertedPersonId_key" ON "target_contacts"("convertedPersonId");

-- CreateIndex
CREATE INDEX "target_contacts_opportunityId_idx" ON "target_contacts"("opportunityId");

-- CreateIndex
CREATE INDEX "interactions_targetContactId_idx" ON "interactions"("targetContactId");

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_contacts" ADD CONSTRAINT "target_contacts_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "target_contacts" ADD CONSTRAINT "target_contacts_convertedPersonId_fkey" FOREIGN KEY ("convertedPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_targetContactId_fkey" FOREIGN KEY ("targetContactId") REFERENCES "target_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
