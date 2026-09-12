-- Remove the unused "CONSULTANCY" value from CompanyType. Postgres has no
-- direct "ALTER TYPE ... DROP VALUE", so the enum is recreated without it.
-- Safe as a straight recreate: no company row currently has this value.
ALTER TYPE "CompanyType" RENAME TO "CompanyType_old";
CREATE TYPE "CompanyType" AS ENUM ('PARTNER', 'ISV', 'END_USER');
ALTER TABLE "companies" ALTER COLUMN "companyType" TYPE "CompanyType" USING ("companyType"::text::"CompanyType");
DROP TYPE "CompanyType_old";
