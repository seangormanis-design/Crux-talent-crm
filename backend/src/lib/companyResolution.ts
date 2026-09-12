import { Prisma, PrismaClient } from "@prisma/client";

// Shared by CSV import, CV parsing review, and BD Opportunity conversion
// (see opportunityConversion.ts): all let the user type a free-text company
// name rather than pick an existing Company by ID, so all need the same
// "find it, or create it" resolution. Accepts a transaction client too, so
// conversion can run atomically alongside its other writes.
export async function resolveCompanyIdByName(
  prisma: PrismaClient | Prisma.TransactionClient,
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
