-- firstName was fully backfilled from the old `name` column in the
-- previous migration step before this one runs, so this is safe.
ALTER TABLE "people" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "people" DROP COLUMN "name";
