-- AlterTable
ALTER TABLE "people" ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "surname" TEXT,
ALTER COLUMN "name" DROP NOT NULL;
