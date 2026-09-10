import { PrismaClient } from "@prisma/client";

// Shared by CSV import and CV parsing review: both let the user type a
// free-text company name rather than pick an existing Company by ID, so
// both need the same "find it, or create it" resolution.
export async function resolveCompanyIdByName(
  prisma: PrismaClient,
  name: string | undefined
): Promise<string | undefined> {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;

  const existing = await prisma.company.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing.id;

  const created = await prisma.company.create({ data: { name: trimmed } });
  return created.id;
}
