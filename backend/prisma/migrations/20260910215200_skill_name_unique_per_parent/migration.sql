-- Skill uniqueness moves from a global name constraint to (parentId, name):
-- the same leaf name can legitimately exist under two different branches
-- (e.g. "Finance" under both D365 F&O and Business Central). All existing
-- names are currently globally unique, so this is a safe, lossless swap.
DROP INDEX "skills_name_key";
CREATE UNIQUE INDEX "skills_parentId_name_key" ON "skills"("parentId", "name");
