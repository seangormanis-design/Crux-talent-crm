-- Split the single `email` field into workEmail/personalEmail. Existing
-- values move to workEmail (this field was always used as the primary/
-- professional contact address in practice), personalEmail starts empty.
ALTER TABLE "people" ADD COLUMN "workEmail" TEXT;
ALTER TABLE "people" ADD COLUMN "personalEmail" TEXT;

UPDATE "people" SET "workEmail" = "email" WHERE "email" IS NOT NULL;

ALTER TABLE "people" DROP COLUMN "email";
