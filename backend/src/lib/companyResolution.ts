import { Prisma, PrismaClient } from "@prisma/client";
import { levenshtein } from "./textSimilarity";

// Trailing corporate-suffix words stripped before comparing two company
// names — repeatedly, so "X Technology Solutions Ltd" reduces the same way
// as "X Technology" or "X Ltd". Order doesn't matter since every suffix is
// tried on every pass; this only ever removes whole trailing words, never
// touches the "core" of a name.
const CORPORATE_SUFFIXES = [
  "technologies",
  "technology",
  "solutions",
  "services",
  "group",
  "holdings",
  "limited",
  "ltd",
  "llp",
  "llc",
  "plc",
  "incorporated",
  "inc",
  "corporation",
  "corp",
  "company",
  "co",
];

// Case/punctuation/whitespace folded only — no suffix stripping. Shared by
// normalizeCompanyName below and used again on its own in
// findFuzzyCompanyMatch, since a typo *inside* a suffix word (e.g. "DXC
// Technolgy") won't be recognized as that suffix and so survives
// normalizeCompanyName's stripping unchanged — comparing the folded-only
// forms as well catches that case too.
function foldCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Folded, then corporate suffixes stripped from the end — "DXC Technology"
// and "DXC" both reduce to "dxc", so they converge on the same Company
// rather than becoming duplicates.
function normalizeCompanyName(name: string): string {
  let s = foldCompanyName(name);

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of CORPORATE_SUFFIXES) {
      const re = new RegExp(`\\s+${suffix}$`, "i");
      if (re.test(s)) {
        s = s.replace(re, "").trim();
        changed = true;
      }
    }
  }

  // Guard against normalizing a name entirely away (e.g. a company actually
  // named "Technology Group") — fall back to the folded-but-unstripped form.
  return s || foldCompanyName(name);
}

// A near-miss (typo, minor variant) rather than a confident match — the
// same length-scaled edit-distance idea as cvExtraction.ts's skill
// matching. Short names are excluded entirely: a distance-1 typo on a short
// acronym ("BT" vs "BP") is far too easy to hit by chance to treat as the
// same company.
function isFuzzyMatch(a: string, b: string): boolean {
  if (a.length < 5 || b.length < 5) return false;
  const maxDist = Math.max(a.length, b.length) <= 8 ? 1 : 2;
  if (Math.abs(a.length - b.length) > maxDist) return false;
  return levenshtein(a, b) <= maxDist;
}

// The read-only half of resolveCompanyIdByName — an exact or
// normalized-suffix match, without ever creating one on a miss. Shared by
// resolveCompanyIdByName below and by job-duplicate checking (see
// findJobDuplicates's caller in jobs.ts): checking whether a same-titled
// Job already exists at "this" company only makes sense when the company
// itself already exists — a brand-new company can't already have a job,
// so that check can skip straight past without side effects.
export async function findExistingCompanyId(
  prisma: PrismaClient | Prisma.TransactionClient,
  name: string | undefined
): Promise<string | undefined> {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;

  const exact = await prisma.company.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (exact) return exact.id;

  const normalizedInput = normalizeCompanyName(trimmed);
  const candidates = await prisma.company.findMany({ select: { id: true, name: true } });
  const normalizedMatch = candidates.find((c) => normalizeCompanyName(c.name) === normalizedInput);
  return normalizedMatch?.id;
}

// Shared by CSV import, CV parsing, and BD Opportunity conversion (see
// opportunityConversion.ts): all let the user type a free-text company
// name rather than pick an existing Company by ID, so all need the same
// "find it, or create it" resolution. Accepts a transaction client too, so
// conversion can run atomically alongside its other writes.
//
// Only an exact or normalized-suffix match auto-links — both are
// confident enough to not need a human to confirm. A merely *fuzzy* match
// (a typo-level near-miss, not a clean suffix reduction) is deliberately
// NOT resolved here: none of this function's callers have a place to ask
// "did you mean X?", so a fuzzy candidate is left to fall through to
// creating a new Company rather than risk silently linking to the wrong
// one. CV/job-post parsing's review screens are the flows with an
// interactive moment to ask that question — see findFuzzyCompanyMatch
// below, which they call separately, before this function is ever invoked
// to actually save.
export async function resolveCompanyIdByName(
  prisma: PrismaClient | Prisma.TransactionClient,
  name: string | undefined
): Promise<string | undefined> {
  const existing = await findExistingCompanyId(prisma, name);
  if (existing) return existing;

  const trimmed = name?.trim();
  if (!trimmed) return undefined;

  const created = await prisma.company.create({ data: { name: trimmed } });
  return created.id;
}

export interface CompanyMatchSuggestion {
  id: string;
  name: string;
}

// Read-only — never creates or links anything itself. Used only where a
// human is actively reviewing extracted fields before saving (CV parsing's
// review screen) to surface "did you mean this existing company?" for a
// near-miss that resolveCompanyIdByName would NOT auto-link (an exact or
// normalized-suffix match doesn't need this at all — only a genuine fuzzy
// near-miss does). The caller decides what to do with the suggestion;
// nothing is resolved or saved here.
export async function findFuzzyCompanyMatch(
  prisma: PrismaClient | Prisma.TransactionClient,
  name: string | undefined
): Promise<CompanyMatchSuggestion | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const foldedInput = foldCompanyName(trimmed);
  const normalizedInput = normalizeCompanyName(trimmed);
  if (foldedInput.length < 5) return null;

  const candidates = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const c of candidates) {
    const foldedExisting = foldCompanyName(c.name);
    const normalizedExisting = normalizeCompanyName(c.name);
    // An exact-after-normalization match isn't a "suggestion" to review —
    // resolveCompanyIdByName already auto-links it without asking.
    if (normalizedExisting === normalizedInput) continue;
    // Checked against both the suffix-stripped and folded-only forms — a
    // typo inside a suffix word (e.g. "DXC Technolgy") only shows up as a
    // near-miss on the folded form, since normalizeCompanyName's suffix
    // stripping won't recognize the misspelled suffix at all.
    if (isFuzzyMatch(normalizedInput, normalizedExisting) || isFuzzyMatch(foldedInput, foldedExisting)) {
      return { id: c.id, name: c.name };
    }
  }
  return null;
}
