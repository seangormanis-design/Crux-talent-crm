// Opportunity cards/list rows are narrow — the full raw pasted text (the
// job-paste "Create as Opportunity" path can carry a multi-paragraph job
// post verbatim into notes) must never render in full outside the
// Opportunity's own detail view, only a short glance-preview here.
const PREVIEW_MAX_LENGTH = 140;

// JobPostCreatePanel's buildOpportunityNotes always writes a single-line
// summary ("Title · Location · ... · £70-85k") followed by a blank line
// before the raw pasted text. Detecting that exact shape — text before the
// first blank line, itself free of embedded newlines — lets this show the
// summary instead of the start of the raw text, without needing a
// dedicated field or a flag stored anywhere.
//
// Requiring the " · " separator specifically (not just "any short first
// line") matters: organic notes very often start with a short heading of
// their own ("About us", "Role overview") immediately followed by a blank
// line, which would otherwise false-positive as if it were the generated
// summary — " · " is what's actually distinctive about that format, not
// mere shortness.
export function summarizeOpportunityNotes(notes: string): string {
  const blankLineIndex = notes.indexOf("\n\n");
  const candidateSummary = blankLineIndex >= 0 ? notes.slice(0, blankLineIndex).trim() : null;
  const isSingleLineSummary = !!candidateSummary && !candidateSummary.includes("\n") && candidateSummary.includes(" · ");

  const source = isSingleLineSummary ? candidateSummary! : notes.replace(/\s+/g, " ").trim();

  return source.length > PREVIEW_MAX_LENGTH ? `${source.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}...` : source;
}
