// Record-type colour coding (standing design rule — see CLAUDE.md):
// Candidates = green, Companies = blue, Client Contacts = orange.
// Colours themselves live as CSS variables in index.css — everything here
// just maps a record kind to the Tailwind arbitrary-value classes that
// reference those variables, so there's one place to repoint if the
// variables are ever renamed.
export type RecordKind = "CANDIDATE" | "CLIENT_CONTACT" | "COMPANY";

export const RECORD_KIND_LABEL: Record<RecordKind, string> = {
  CANDIDATE: "Candidate",
  CLIENT_CONTACT: "Client Contact",
  COMPANY: "Company",
};

export const RECORD_KIND_TEXT_CLASS: Record<RecordKind, string> = {
  CANDIDATE: "text-[var(--color-candidate)]",
  CLIENT_CONTACT: "text-[var(--color-client-contact)]",
  COMPANY: "text-[var(--color-company)]",
};

export const RECORD_KIND_DOT_CLASS: Record<RecordKind, string> = {
  CANDIDATE: "bg-[var(--color-candidate)]",
  CLIENT_CONTACT: "bg-[var(--color-client-contact)]",
  COMPANY: "bg-[var(--color-company)]",
};

// Left-border accent for list rows/cards — `border-l-4` (or similar) plus
// this class gives the subtle coloured-edge treatment used across the app.
export const RECORD_KIND_BORDER_CLASS: Record<RecordKind, string> = {
  CANDIDATE: "border-l-[var(--color-candidate)]",
  CLIENT_CONTACT: "border-l-[var(--color-client-contact)]",
  COMPANY: "border-l-[var(--color-company)]",
};

// Tinted badge background + matching text, for "Also linked as X" style pills.
export const RECORD_KIND_BADGE_CLASS: Record<RecordKind, string> = {
  CANDIDATE: "bg-[var(--color-candidate-bg)] text-[var(--color-candidate)]",
  CLIENT_CONTACT: "bg-[var(--color-client-contact-bg)] text-[var(--color-client-contact)]",
  COMPANY: "bg-[var(--color-company-bg)] text-[var(--color-company)]",
};

export function personRecordKind(person: { personType?: string | null }): RecordKind {
  return person?.personType === "CLIENT_CONTACT" ? "CLIENT_CONTACT" : "CANDIDATE";
}

// Convenience: the Tailwind text-colour class for a Link to a Person record.
export function personLinkClass(person: { personType?: string | null }): string {
  return RECORD_KIND_TEXT_CLASS[personRecordKind(person)];
}

export const COMPANY_LINK_CLASS = RECORD_KIND_TEXT_CLASS.COMPANY;
