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
  skillNames: string[];
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

function guessSkills(text: string, knownSkillNames: string[]): string[] {
  const lower = text.toLowerCase();
  return knownSkillNames.filter((name) => lower.includes(name.toLowerCase()));
}

export function extractCvFields(text: string, knownSkillNames: string[]): ExtractedCvFields {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const email = text.match(EMAIL_RE)?.[0];
  const phoneMatch = text.match(PHONE_RE)?.[0];
  const phone = phoneMatch?.replace(/\s+/g, " ").trim();
  const { title, employer } = guessTitleAndEmployer(text);

  return {
    ...guessName(lines),
    email,
    phone,
    currentTitle: title,
    currentEmployerName: employer,
    skillNames: guessSkills(text, knownSkillNames),
  };
}
