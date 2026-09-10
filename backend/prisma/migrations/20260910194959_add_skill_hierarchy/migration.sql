/*
  Warnings:

  - You are about to drop the column `category` on the `skills` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "person_skills" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "skills" DROP COLUMN "category",
ADD COLUMN     "parentId" TEXT;

-- CreateIndex
CREATE INDEX "skills_parentId_idx" ON "skills"("parentId");

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
