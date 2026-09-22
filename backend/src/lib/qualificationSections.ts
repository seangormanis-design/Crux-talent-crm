// The 7-section Qualification Call template — canonical list of section
// keys (matching Interaction's qc* columns) and the exact plain-text labels
// baked into `notes` for backward compatibility with everything that reads
// notes as one blob (full-text search's NOTE_SECTION_LABELS, Extract
// Intelligence, Reflect on Call, the plain interaction-history render).
export const QUALIFICATION_CALL_SECTIONS = [
  { key: "qcPresent", label: "PRESENT" },
  { key: "qcPast", label: "PAST" },
  { key: "qcFuture", label: "FUTURE" },
  { key: "qcAob", label: "AOB" },
  { key: "qcThreats", label: "THREATS" },
  { key: "qcLeads", label: "LEADS" },
  { key: "qcPersonalInfo", label: "PERSONAL INFO" },
] as const;

export type QualificationSectionKey = (typeof QUALIFICATION_CALL_SECTIONS)[number]["key"];

export type QualificationSections = Partial<Record<QualificationSectionKey, string | null | undefined>>;

// Same concatenation People.tsx's buildQualificationCallNotes produces on
// the frontend — kept here too since `notes` is now computed server-side
// (the single source of truth moved off the client) rather than trusted
// from whatever the frontend happened to send.
export function buildQualificationCallNotes(sections: QualificationSections): string {
  return QUALIFICATION_CALL_SECTIONS.map(({ key, label }) => {
    const text = sections[key]?.trim();
    return text ? `${label}:\n${text}` : null;
  })
    .filter(Boolean)
    .join("\n\n");
}
