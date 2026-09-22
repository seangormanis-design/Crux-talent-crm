// @ts-ignore — pdf-parse ships no types; the default export is
// (buffer: Buffer) => Promise<{ text: string }>.
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { levenshtein } from "./textSimilarity";

export interface ExtractedCvFields {
  firstName?: string;
  surname?: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  currentEmployerName?: string;
  // Confident matches (exact, after normalizing spacing/punctuation/case and
  // expanding known domain abbreviations) vs. fuzzy near-matches that should
  // be reviewed rather than silently included.
  confirmedSkillNames: string[];
  suggestedSkillNames: string[];
}

const EXTRACTION_TIMEOUT_MS = 20000;

// pdf-parse (an old bundled pdf.js) and mammoth can both hang indefinitely —
// rather than throw — on certain malformed, encrypted, or otherwise unusual
// real-world files. With nothing else in the stack bounding these calls
// (no request timeout on either the frontend fetch or this route), a hang
// here used to mean the upload UI sat on "Parsing..." forever: no success,
// no error, nothing in the logs, since a promise that never settles never
// reaches a catch block. Racing against a timeout guarantees this always
// resolves or rejects within a bounded time.
async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function extractTextFromCv(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const isDocx =
    mimeType.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx");
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    // pdf-parse's bundled (old) pdf.js build misreads a Node Buffer's
    // internal structure and throws "bad XRef entry" on an otherwise valid
    // PDF — it needs a plain Uint8Array copy, not a Buffer instance (Buffer
    // subclasses Uint8Array, which isn't the same thing to it internally).
    const result = await withTimeout(
      pdfParse(new Uint8Array(buffer)) as Promise<{ text: string }>,
      EXTRACTION_TIMEOUT_MS,
      "Parsing this PDF took too long — it may be corrupted, password-protected, or in an unusual format."
    );
    return result.text;
  }
  if (isDocx) {
    const result = await withTimeout(
      mammoth.extractRawText({ buffer }),
      EXTRACTION_TIMEOUT_MS,
      "Parsing this Word document took too long — it may be corrupted or in an unusual format."
    );
    return result.value;
  }
  throw new Error("Only PDF and .docx CVs are supported (legacy .doc files aren't).");
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{8,}\d)/;

function guessName(lines: string[]): { firstName?: string; surname?: string } {
  // A CV's name is almost always the very first non-empty line, and is
  // short, has no digits, and isn't an email/URL. Best-effort only — the
  // whole point of this feature is a human reviews it before saving.
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > 60) continue;
    if (EMAIL_RE.test(trimmed) || /\d/.test(trimmed) || trimmed.includes("http")) continue;
    const words = trimmed.split(/\s+/);
    if (words.length > 5) continue;
    return { firstName: words[0], surname: words.slice(1).join(" ") || undefined };
  }
  return {};
}

// If the CV has a recognizable "Experience"/"Work Experience"/"Employment
// History" heading, only look at lines from there onward — the section is
// specifically job history, so a "Title · Company" line found there is
// trusted even without a trailing date. Outside such a section (or when no
// heading is found at all), the same shape is common for a purely personal
// tagline near the top of a CV (e.g. "Lead Consultant · Health Data
// Platforms") which is *not* a job entry — see the dotMatch handling below
// for how that risk is avoided.
function findExperienceSectionStart(lines: string[]): number {
  return lines.findIndex((l) => /^\s*(work\s+)?experience\b/i.test(l) || /^\s*employment\s+history\b/i.test(l));
}

function guessTitleAndEmployer(text: string): { title?: string; employer?: string } {
  const lines = text.split("\n");
  const experienceStart = findExperienceSectionStart(lines);

  // Inside a recognized Experience section, a CV lists jobs in reverse-
  // chronological order — the FIRST "·" line found there is the current/
  // most recent role, which is what we want, and later ones are past jobs
  // (a multi-job CV can have several, all in the same shape). Return on the
  // first match immediately, exactly like the "at"/dash patterns below.
  if (experienceStart >= 0) {
    for (const line of lines.slice(experienceStart, experienceStart + 60)) {
      // A "·"-bulleted line is handled exclusively by the dot-parsing below
      // — a trailing date range often contains its own "-"/"—" (e.g. "2021
      // - Present"), which the dash pattern would otherwise greedily match
      // across the whole line instead of stopping at the real title/company
      // boundary.
      if (line.includes("·")) {
        const dotParts = line
          .split("·")
          .map((p) => p.trim())
          .filter(Boolean);
        if (dotParts.length >= 2 && dotParts[0].length >= 3 && dotParts[1].length >= 2) {
          return { title: dotParts[0], employer: dotParts[1] };
        }
        continue;
      }

      const atMatch = line.match(/^(.{3,60}?)\s+at\s+(.{2,60})$/i);
      if (atMatch) return { title: atMatch[1].trim(), employer: atMatch[2].trim() };

      const dashMatch = line.match(/^(.{3,60}?)\s+[—-]\s+(.{2,60})$/);
      if (dashMatch) return { title: dashMatch[1].trim(), employer: dashMatch[2].trim() };
    }
    return {};
  }

  // No Experience heading found — fall back to scanning the top of the
  // document, same as before this section-aware path existed. The "·"
  // shape is ambiguous here: a real job-history line ("Title · Company ·
  // Dates") and a personal tagline right under the candidate's name ("Title
  // · Subtitle") look identical when only two parts are present, and a
  // tagline (if any) always appears before the real entry — so rather than
  // return on the first "·" match, every candidate is collected and the
  // *last* one is used instead, and a trailing segment that looks like a
  // date range is required as confirmation this is really a job entry, not
  // just any two-part sentence that happens to contain a "·".
  let lastDotMatch: { title: string; employer: string } | null = null;

  for (const line of lines.slice(0, 40)) {
    if (line.includes("·")) {
      const dotParts = line
        .split("·")
        .map((p) => p.trim())
        .filter(Boolean);
      if (dotParts.length >= 3 && dotParts[0].length >= 3 && dotParts[1].length >= 2) {
        const lastPart = dotParts[dotParts.length - 1];
        const looksDated = /\b(19|20)\d{2}\b|\bpresent\b/i.test(lastPart);
        if (looksDated) {
          lastDotMatch = { title: dotParts[0], employer: dotParts[1] };
        }
      }
      continue;
    }

    const atMatch = line.match(/^(.{3,60}?)\s+at\s+(.{2,60})$/i);
    if (atMatch) return { title: atMatch[1].trim(), employer: atMatch[2].trim() };

    const dashMatch = line.match(/^(.{3,60}?)\s+[—-]\s+(.{2,60})$/);
    if (dashMatch) return { title: dashMatch[1].trim(), employer: dashMatch[2].trim() };
  }

  return lastDotMatch ?? {};
}

// A handful of stable, unambiguous abbreviations that are core vocabulary in
// this domain (not a per-skill synonym dictionary, which would need constant
// upkeep as the tree grows) — applied to the CV text so "Dynamics 365 Finance
// and Operations" converges on the same form as the skill name "D365 F&O".
const DOMAIN_ALIASES: [RegExp, string][] = [
  [/\bdynamics\s*365\b/gi, "d365"],
  [/\bfinance\s*(?:and|&)\s*operations\b/gi, "f&o"],
  [/\bcustomer\s*engagement\b/gi, "ce"],
];

function expandDomainAliases(text: string): string {
  return DOMAIN_ALIASES.reduce((out, [re, replacement]) => out.replace(re, replacement), text);
}

// Strips everything but letters/digits after alias expansion, so "Power
// Apps", "PowerApps" and "Power-Apps" all collapse to the same "powerapps"
// key — this is what makes spacing/punctuation/case variants match.
function normalizeCompact(s: string): string {
  return expandDomainAliases(s.toLowerCase()).replace(/[^a-z0-9]/g, "");
}

const STOPWORDS = new Set(["and", "or", "the", "of", "in", "with", "for", "a", "to", "&"]);

function tokenize(s: string): string[] {
  return expandDomainAliases(s.toLowerCase())
    .match(/[a-z0-9]+/g)
    ?.filter((t) => !STOPWORDS.has(t)) ?? [];
}

// A token "fuzzily appears" if it's an exact match, or within a small edit
// distance of some token in the text — catches typos and minor variants
// ("Automat" / "Automates") without flagging on short, noisy tokens.
function tokenFuzzyPresent(token: string, textTokens: string[]): boolean {
  if (textTokens.includes(token)) return true;
  if (token.length < 5) return false;
  const maxDist = token.length <= 6 ? 1 : 2;
  return textTokens.some((t) => Math.abs(t.length - token.length) <= maxDist && levenshtein(token, t) <= maxDist);
}

// Exported for reuse against non-CV text (Extract Intelligence suggests
// candidate skills mentioned in call notes using this exact matching).
export function guessSkills(text: string, knownSkillNames: string[]): { confirmed: string[]; suggested: string[] } {
  const compactText = normalizeCompact(text);
  const textTokens = tokenize(text);

  const confirmed: string[] = [];
  const suggested: string[] = [];

  for (const name of knownSkillNames) {
    // Tier 1: exact match once both sides are normalized/alias-expanded —
    // this alone catches spacing, punctuation, casing, and D365/F&O/CE
    // variants without ever guessing.
    if (compactText.includes(normalizeCompact(name))) {
      confirmed.push(name);
      continue;
    }

    // Tier 2: every significant word of the skill name shows up somewhere
    // in the text, exactly or as a near-miss — a looser, order-independent
    // signal, so it's surfaced for approval rather than auto-included.
    // Every token must be present — short tokens (e.g. "CE" in "D365 CE")
    // still have to match exactly (tokenFuzzyPresent only fuzzes tokens of
    // length >= 5), they just aren't dropped from the requirement entirely.
    // Dropping them would let e.g. "D365 CE" match on a shared "d365" alone.
    const nameTokens = tokenize(name);
    if (nameTokens.length > 0 && nameTokens.every((t) => tokenFuzzyPresent(t, textTokens))) {
      suggested.push(name);
    }
  }

  return { confirmed, suggested };
}

export function extractCvFields(text: string, knownSkillNames: string[]): ExtractedCvFields {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const email = text.match(EMAIL_RE)?.[0];
  const phoneMatch = text.match(PHONE_RE)?.[0];
  const phone = phoneMatch?.replace(/\s+/g, " ").trim();
  const { title, employer } = guessTitleAndEmployer(text);
  const { confirmed, suggested } = guessSkills(text, knownSkillNames);

  return {
    ...guessName(lines),
    email,
    phone,
    currentTitle: title,
    currentEmployerName: employer,
    confirmedSkillNames: confirmed,
    suggestedSkillNames: suggested,
  };
}
