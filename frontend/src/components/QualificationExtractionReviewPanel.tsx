import { useEffect, useState } from "react";
import { api } from "../api/client";
import { QC_SECTION_FIELDS, QcSectionField } from "../lib/qualificationSections";

type QcValues = Record<QcSectionField, string>;

const EXTRACTION_TIMEOUT_MS = 25000;

const EMPTY_VALUES: QcValues = {
  qcPresent: "",
  qcPast: "",
  qcFuture: "",
  qcAob: "",
  qcThreats: "",
  qcLeads: "",
  qcPersonalInfo: "",
};

// Shown whenever a transcript is attached to a Qualification Call — either
// right after logging it with a transcript already pasted in, or after
// attaching one later via the "Attach transcript" action. Extraction fires
// automatically on mount, but nothing is ever saved without the explicit
// "Save sections" click below: the AI draft is shown alongside whatever was
// already manually typed (never silently merged or overwritten), and the
// editable field the user actually saves defaults to their own existing
// text — untouched — with the draft available to copy from if useful.
export default function QualificationExtractionReviewPanel({
  interactionId,
  transcript,
  existingSections,
  onDone,
  onDismiss,
}: {
  interactionId: string;
  transcript: string;
  existingSections: Partial<QcValues>;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const [drafting, setDrafting] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [drafted, setDrafted] = useState<QcValues | null>(null);
  const [finalValues, setFinalValues] = useState<QcValues>({ ...EMPTY_VALUES, ...existingSections });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!drafting) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [drafting]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDrafting(true);
      setDraftError(null);
      try {
        const result = await api.post<QcValues>(
          `/api/interactions/${interactionId}/extract-qualification-sections`,
          undefined,
          EXTRACTION_TIMEOUT_MS
        );
        if (cancelled) return;
        setDrafted(result);
        // Only fill in sections the recruiter hasn't already written
        // anything for — an already-written section is never touched
        // automatically, the draft is just shown alongside it instead.
        setFinalValues((prev) => {
          const next = { ...prev };
          for (const { field } of QC_SECTION_FIELDS) {
            if (!next[field]?.trim() && result[field]?.trim()) next[field] = result[field];
          }
          return next;
        });
      } catch (err) {
        if (!cancelled) setDraftError(err instanceof Error ? err.message : "Could not draft sections from the transcript");
      } finally {
        if (!cancelled) setDrafting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactionId]);

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/api/interactions/${interactionId}`, finalValues);
      onDone();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save these sections");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-3 rounded border border-blue-200 bg-blue-50 p-3">
      <p className="text-xs font-medium uppercase text-blue-700">Extracting Qualification Call sections from transcript</p>

      {drafting && (
        <div>
          <p className="text-sm text-slate-500">Drafting from transcript... ({elapsedSeconds}s)</p>
          {elapsedSeconds >= 10 && (
            <p className="mt-1 text-xs text-amber-600">
              This is taking longer than usual — it will show an error within{" "}
              {Math.max(0, Math.round(EXTRACTION_TIMEOUT_MS / 1000) - elapsedSeconds)}s if it doesn't finish.
            </p>
          )}
        </div>
      )}
      {draftError && <p className="text-sm text-red-600">{draftError}</p>}

      {!drafting && drafted && (
        <p className="text-xs text-slate-500">
          AI-drafted — review before saving. Sections you'd already written are left exactly as they were; the
          draft is shown alongside them for you to copy in, edit, or ignore.
        </p>
      )}

      <div className="space-y-3">
        {QC_SECTION_FIELDS.map(({ field, label }) => {
          const hadExisting = !!existingSections[field]?.trim();
          const draftText = drafted?.[field]?.trim();
          return (
            <div key={field}>
              <span className="mb-0.5 block text-xs font-medium uppercase text-slate-500">{label}</span>
              {hadExisting && (
                <p className="mb-1 whitespace-pre-wrap rounded bg-white p-1.5 text-xs text-slate-500">
                  <span className="font-medium text-slate-400">Your notes: </span>
                  {existingSections[field]}
                </p>
              )}
              {draftText && (
                <p className="mb-1 whitespace-pre-wrap rounded border border-dashed border-blue-300 bg-white p-1.5 text-xs text-slate-600">
                  <span className="font-medium text-blue-500">AI draft: </span>
                  {draftText}
                </p>
              )}
              <textarea
                className="w-full rounded border px-2 py-1.5 text-sm"
                rows={2}
                placeholder="Leave blank if it didn't come up"
                value={finalValues[field]}
                onChange={(e) => setFinalValues((prev) => ({ ...prev, [field]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">View transcript</summary>
        <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-white p-2">{transcript}</p>
      </details>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded border px-3 py-1.5 text-sm hover:bg-white"
        >
          Close without saving
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save sections"}
        </button>
      </div>
    </div>
  );
}
