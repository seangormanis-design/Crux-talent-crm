// Standalone, idempotent role-type seeder — safe to run against a database
// that already has real data. Run with: npm run seed:role-types
import { PrismaClient } from "@prisma/client";
import { seedRoleTypes } from "../src/lib/roleTypes";

const prisma = new PrismaClient();

seedRoleTypes(prisma)
  .then(() => console.log("Role types seeded."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
