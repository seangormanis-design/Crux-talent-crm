// Standalone, idempotent skill-tree seeder — safe to run against a database
// that already has real data (unlike seed.ts, which creates fresh demo
// records every run). Run with: npm run seed:skills
import { PrismaClient } from "@prisma/client";
import { seedSkillTree } from "../src/lib/skillTree";

const prisma = new PrismaClient();

seedSkillTree(prisma)
  .then(() => console.log("Skill tree seeded."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
