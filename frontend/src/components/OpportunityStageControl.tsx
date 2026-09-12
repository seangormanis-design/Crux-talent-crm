import { useState } from "react";
import { api } from "../api/client";
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS, LOST_REASON_TAGS } from "../pages/BdFunnel";
import CompanyTermsPanel from "./CompanyTermsPanel";

interface StageChangeResponse {
  company: { id: string; name: string; needsTermsSetup: boolean } | null;
}

// Shared stage-change control for a BD Opportunity — the select plus the
// inline "reason required" prompt when moving to Lost. Used on the BD
// Funnel kanban card, the Company page's Opportunities tab, and the
// Opportunity detail page, so the Lost-reason rule can't drift between them.
export default function OpportunityStageControl({
  opportunityId,
  stage,
  onChanged,
  className = "",
}: {
  opportunityId: string;
  stage: string;
  onChanged: () => void;
  className?: string;
}) {
  const [lostPrompt, setLostPrompt] = useState(false);
  const [lostReasonDraft, setLostReasonDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set the moment a Won transition converts a company to Active Client
  // with no Terms on file yet — see CLAUDE.md's Terms onboarding rule.
  // Self-contained here (rather than a callback prop threaded through the 3
  // pages this control is embedded in) so the prompt fires wherever Won is
  // clicked, with no extra wiring at each call site.
  const [termsPromptCompany, setTermsPromptCompany] = useState<{ id: string; name: string } | null>(null);

  async function moveStage(newStage: string) {
    if (newStage === "LOST") {
      setLostPrompt(true);
      setLostReasonDraft("");
      return;
    }
    setError(null);
    try {
      const updated = await api.post<StageChangeResponse>(`/api/opportunities/${opportunityId}/stage`, { stage: newStage });
      onChanged();
      if (newStage === "WON" && updated.company?.needsTermsSetup) {
        setTermsPromptCompany({ id: updated.company.id, name: updated.company.name });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change stage");
    }
  }

  async function confirmLost() {
    if (!lostReasonDraft.trim()) return;
    setError(null);
    try {
      await api.post(`/api/opportunities/${opportunityId}/stage`, {
        stage: "LOST",
        lostReason: lostReasonDraft.trim(),
      });
      setLostPrompt(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change stage");
    }
  }

  return (
    <div className={className}>
      {error && <p className="mb-1 text-xs text-red-600">{error}</p>}
      <select
        className="w-full rounded border px-1 py-1 text-xs"
        value={stage}
        onChange={(e) => moveStage(e.target.value)}
      >
        {OPPORTUNITY_STAGES.map((s) => (
          <option key={s} value={s}>
            {OPPORTUNITY_STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      {lostPrompt && (
        <div className="mt-2 space-y-1 rounded border bg-slate-50 p-2 text-xs">
          <p className="font-medium text-slate-600">Reason for losing this opportunity:</p>
          <div className="flex flex-wrap gap-1">
            {LOST_REASON_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setLostReasonDraft(tag === "Other" ? "" : tag)}
                className="rounded-full border px-2 py-0.5 hover:bg-slate-100"
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            autoFocus
            className="w-full rounded border px-2 py-1"
            placeholder="Reason (required)"
            value={lostReasonDraft}
            onChange={(e) => setLostReasonDraft(e.target.value)}
          />
          <div className="flex gap-1">
            <button
              type="button"
              disabled={!lostReasonDraft.trim()}
              onClick={confirmLost}
              className="rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
            >
              Confirm Lost
            </button>
            <button
              type="button"
              onClick={() => setLostPrompt(false)}
              className="rounded border px-2 py-1 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {termsPromptCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded border bg-white p-4 shadow-lg">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Set up Terms for {termsPromptCompany.name}</h2>
              <button
                type="button"
                onClick={() => setTermsPromptCompany(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-sm text-slate-500">
              {termsPromptCompany.name} just became an Active Client. Fee structure, payment terms, and an invoicing
              contact are worth capturing now — or do it later from the Company page's Terms tab.
            </p>
            <CompanyTermsPanel companyId={termsPromptCompany.id} companyName={termsPromptCompany.name} onSaved={onChanged} />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTermsPromptCompany(null)}
                className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Do this later
              </button>
              <button
                type="button"
                onClick={() => setTermsPromptCompany(null)}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
