-- CreateTable
CREATE TABLE "role_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "role_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PersonRoleTypes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_JobRoleTypes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "role_types_name_key" ON "role_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "_PersonRoleTypes_AB_unique" ON "_PersonRoleTypes"("A", "B");

-- CreateIndex
CREATE INDEX "_PersonRoleTypes_B_index" ON "_PersonRoleTypes"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_JobRoleTypes_AB_unique" ON "_JobRoleTypes"("A", "B");

-- CreateIndex
CREATE INDEX "_JobRoleTypes_B_index" ON "_JobRoleTypes"("B");

-- AddForeignKey
ALTER TABLE "_PersonRoleTypes" ADD CONSTRAINT "_PersonRoleTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonRoleTypes" ADD CONSTRAINT "_PersonRoleTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "role_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobRoleTypes" ADD CONSTRAINT "_JobRoleTypes_A_fkey" FOREIGN KEY ("A") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobRoleTypes" ADD CONSTRAINT "_JobRoleTypes_B_fkey" FOREIGN KEY ("B") REFERENCES "role_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
