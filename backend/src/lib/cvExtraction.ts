// @ts-ignore — pdf-parse ships no types; the default export is
// (buffer: Buffer) => Promise<{ text: string }>.
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

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

export async function extractTextFromCv(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const isDocx =
    mimeType.includes("wordprocessingml") || fileName.toLowerCase().endsWith(".docx");
  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    // pdf-parse's bundled (old) pdf.js build misreads a Node Buffer's
    // internal structure and throws "bad XRef entry" on an otherwise valid
    // PDF — it needs a plain Uint8Array copy, not a Buffer instance (Buffer
    // subclasses Uint8Array, which isn't the same thing to it internally).
    const result = await pdfParse(new Uint8Array(buffer));
    return result.text;
  }
  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
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

function guessTitleAndEmployer(text: string): { title?: string; employer?: string } {
  // Common CV phrasing: "<Title> at <Company>" or "<Title>, <Company>" or
  // "<Title> — <Company>" near the top of the document (current/most
  // recent role usually appears first).
  const candidateLines = text.split("\n").slice(0, 40);

  for (const line of candidateLines) {
    const atMatch = line.match(/^(.{3,60}?)\s+at\s+(.{2,60})$/i);
    if (atMatch) return { title: atMatch[1].trim(), employer: atMatch[2].trim() };

    const dashMatch = line.match(/^(.{3,60}?)\s+[—-]\s+(.{2,60})$/);
    if (dashMatch) return { title: dashMatch[1].trim(), employer: dashMatch[2].trim() };
  }

  return {};
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

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
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

function guessSkills(text: string, knownSkillNames: string[]): { confirmed: string[]; suggested: string[] } {
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
