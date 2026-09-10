import { Prisma, PrismaClient } from "@prisma/client";

export interface DuplicateCandidate {
  firstName?: string;
  surname?: string;
  workEmail?: string;
  personalEmail?: string;
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

function fullName(p: { firstName?: string | null; surname?: string | null }): string {
  return [p.firstName, p.surname].filter(Boolean).join(" ").trim();
}

// Shared by manual person creation and CSV import, per the spec's
// requirement that imports go through the same duplicate-detection logic
// as manual entry. Matches on LinkedIn URL, phone number, either email
// field against either of the target's email fields, or an exact
// (case-insensitive) full-name match — any one of these is enough to
// surface a candidate match; the caller decides what to do about it.
export async function findPersonDuplicates(
  prisma: PrismaClient,
  candidate: DuplicateCandidate,
  excludePersonId?: string
): Promise<DuplicateMatch[]> {
  const { firstName, surname, workEmail, personalEmail, phone, linkedinUrl } = candidate;
  const candidateEmails = [workEmail, personalEmail].map((e) => e?.trim().toLowerCase()).filter(Boolean) as string[];
  const candidateFullName = fullName({ firstName, surname }).toLowerCase();

  const orConditions: Prisma.PersonWhereInput[] = [];
  if (linkedinUrl?.trim()) orConditions.push({ linkedinUrl: { equals: linkedinUrl.trim(), mode: "insensitive" } });
  for (const e of candidateEmails) {
    orConditions.push({ workEmail: { equals: e, mode: "insensitive" } });
    orConditions.push({ personalEmail: { equals: e, mode: "insensitive" } });
  }
  if (firstName?.trim()) {
    // Narrow the SQL-level candidate pool by first name (which Postgres can
    // match natively); the exact full-name-including-surname comparison
    // happens in application code below, the same way phone matching does.
    orConditions.push({ firstName: { equals: firstName.trim(), mode: "insensitive" } });
  }

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
    const personEmails = [person.workEmail, person.personalEmail].map((e) => e?.toLowerCase()).filter(Boolean);
    if (candidateEmails.length && personEmails.some((e) => candidateEmails.includes(e!))) {
      matchedOn.push("email");
    }
    if (candidateFullName && fullName(person).toLowerCase() === candidateFullName) {
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
