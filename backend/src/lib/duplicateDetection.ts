import { Prisma, PrismaClient } from "@prisma/client";

export interface DuplicateCandidate {
  name?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

export interface DuplicateMatch {
  person: Prisma.PersonGetPayload<{}>;
  matchedOn: ("linkedinUrl" | "phone" | "email" | "name")[];
}

// Digits-only comparison so "+44 7700 900123" and "07700900123" still match.
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Shared by manual person creation and CSV import, per the spec's
// requirement that imports go through the same duplicate-detection logic
// as manual entry. Matches on LinkedIn URL, phone number, email, or an
// exact (case-insensitive) full-name match — any one of these is enough
// to surface a candidate match; the caller decides what to do about it.
export async function findPersonDuplicates(
  prisma: PrismaClient,
  candidate: DuplicateCandidate,
  excludePersonId?: string
): Promise<DuplicateMatch[]> {
  const { name, email, phone, linkedinUrl } = candidate;

  const orConditions: Prisma.PersonWhereInput[] = [];
  if (linkedinUrl?.trim()) orConditions.push({ linkedinUrl: { equals: linkedinUrl.trim(), mode: "insensitive" } });
  if (email?.trim()) orConditions.push({ email: { equals: email.trim(), mode: "insensitive" } });
  if (name?.trim()) orConditions.push({ name: { equals: name.trim(), mode: "insensitive" } });

  if (!orConditions.length && !phone?.trim()) return [];

  const candidates = await prisma.person.findMany({
    where: {
      deletedAt: null,
      id: excludePersonId ? { not: excludePersonId } : undefined,
      OR: orConditions.length ? orConditions : undefined,
    },
  });

  // Phone needs digit-normalized comparison, which Postgres can't do
  // cheaply in a WHERE clause here, so it's matched in application code
  // against a broader candidate pool fetched separately when provided.
  const normalizedPhone = phone?.trim() ? normalizePhone(phone) : null;
  let phoneMatches: Prisma.PersonGetPayload<{}>[] = [];
  if (normalizedPhone) {
    const withPhone = await prisma.person.findMany({
      where: { deletedAt: null, id: excludePersonId ? { not: excludePersonId } : undefined, phone: { not: null } },
    });
    phoneMatches = withPhone.filter((p) => p.phone && normalizePhone(p.phone) === normalizedPhone);
  }

  const byId = new Map<string, DuplicateMatch>();

  for (const person of candidates) {
    const matchedOn: DuplicateMatch["matchedOn"] = [];
    if (linkedinUrl?.trim() && person.linkedinUrl?.toLowerCase() === linkedinUrl.trim().toLowerCase()) {
      matchedOn.push("linkedinUrl");
    }
    if (email?.trim() && person.email?.toLowerCase() === email.trim().toLowerCase()) {
      matchedOn.push("email");
    }
    if (name?.trim() && person.name.toLowerCase() === name.trim().toLowerCase()) {
      matchedOn.push("name");
    }
    if (matchedOn.length) byId.set(person.id, { person, matchedOn });
  }

  for (const person of phoneMatches) {
    const existing = byId.get(person.id);
    if (existing) existing.matchedOn.push("phone");
    else byId.set(person.id, { person, matchedOn: ["phone"] });
  }

  return Array.from(byId.values());
}
