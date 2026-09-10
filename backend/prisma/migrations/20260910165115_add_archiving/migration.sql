-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "people" ADD COLUMN     "archivedAt" TIMESTAMP(3);
