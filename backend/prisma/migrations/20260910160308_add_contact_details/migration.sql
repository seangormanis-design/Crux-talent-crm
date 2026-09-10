-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressPostcode" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "addressCity" TEXT,
ADD COLUMN     "addressPostcode" TEXT,
ADD COLUMN     "addressStreet" TEXT,
ADD COLUMN     "linkedinUrl" TEXT;
