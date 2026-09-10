import { PrismaClient } from "@prisma/client";

// Starter set — grows via the same "add new on the fly" idiom as the Skill
// tree (upsert-by-name), just without any hierarchy.
export const ROLE_TYPES: string[] = [
  "Functional Consultant",
  "Technical Consultant/Developer",
  "Solution Architect",
  "Enterprise Architect",
  "Project Manager",
  "Business Analyst",
  "QA/Tester",
  "Pre-Sales/Solution Consultant",
  "Application Support/Consultant",
  "Trainer",
];

export async function seedRoleTypes(prisma: PrismaClient, names: string[] = ROLE_TYPES) {
  for (const name of names) {
    await prisma.roleType.upsert({ where: { name }, update: {}, create: { name } });
  }
}
