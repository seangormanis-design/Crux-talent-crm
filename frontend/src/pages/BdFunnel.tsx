import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import OpportunityCreateForm from "../components/OpportunityCreateForm";
import { COMPANY_LINK_CLASS, RECORD_KIND_BORDER_CLASS } from "../lib/recordColors";

export const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  IDENTIFIED: "Identified",
  RESEARCHED: "Researched",
  CONTACTED: "Contacted",
  MEETING_BOOKED: "Meeting Booked",
  PROPOSAL_SENT: "Proposal Sent",
  WON: "Won",
  LOST: "Lost",
};
export const OPPORTUNITY_STAGES = Object.keys(OPPORTUNITY_STAGE_LABELS);

export const LOST_REASON_TAGS = ["Price", "Timing", "Chose competitor", "Other"];

interface Opportunity {
  id: string;
  title: string;
  notes?: string | null;
  stage: string;
  lostReason?: string | null;
  company: { id: string; name: string };
}

export default function BdFunnel() {
  const [board, setBoard] = useState<Record<string, Opportunity[]>>({});
  const [showForm, setShowForm] = useState(false);
  const [lostPromptFor, setLostPromptFor] = useState<string | null>(null);
  const [lostReasonDraft, setLostReasonDraft] = useState("");

  function load() {
    api.get<Record<string, Opportunity[]>>("/api/opportunities/board").then(setBoard);
  }

  useEffect(load, []);

  function moveStage(id: string, stage: string) {
    if (stage === "LOST") {
      setLostPromptFor(id);
      setLostReasonDraft("");
      return;
    }
    api.post(`/api/opportunities/${id}/stage`, { stage }).then(load);
  }

  async function confirmLost(id: string) {
    if (!lostReasonDraft.trim()) return;
    await api.post(`/api/opportunities/${id}/stage`, { stage: "LOST", lostReason: lostReasonDraft.trim() });
    setLostPromptFor(null);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">BD Funnel</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          {showForm ? "Cancel" : "New opportunity"}
        </button>
      </div>

      {showForm && (
        <OpportunityCreateForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="flex gap-3 overflow-x-auto">
        {OPPORTUNITY_STAGES.map((stage) => (
          <div key={stage} className="w-64 shrink-0 rounded border bg-white">
            <div className="border-b bg-slate-100 px-3 py-2 text-sm font-medium">
              {OPPORTUNITY_STAGE_LABELS[stage]} ({board[stage]?.length ?? 0})
            </div>
            <div className="space-y-2 p-2">
              {board[stage]?.map((opp) => (
                <div key={opp.id} className={`rounded border border-l-4 p-2 text-xs ${RECORD_KIND_BORDER_CLASS.COMPANY}`}>
                  <Link to={`/companies/${opp.company.id}`} className={`font-medium ${COMPANY_LINK_CLASS}`}>
                    {opp.company.name}
                  </Link>
                  <p className="text-slate-700">{opp.title}</p>
                  {opp.notes && <p className="mt-0.5 text-slate-500">{opp.notes}</p>}
                  {opp.stage === "LOST" && opp.lostReason && (
                    <p className="mt-1 rounded bg-slate-50 px-1.5 py-1 text-slate-500">Lost: {opp.lostReason}</p>
                  )}

                  <select
                    className="mt-1 w-full rounded border px-1 py-1 text-xs"
                    value={opp.stage}
                    onChange={(e) => moveStage(opp.id, e.target.value)}
                  >
                    {OPPORTUNITY_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {OPPORTUNITY_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>

                  {lostPromptFor === opp.id && (
                    <div className="mt-2 space-y-1 rounded border bg-slate-50 p-2">
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
                          onClick={() => confirmLost(opp.id)}
                          className="rounded bg-slate-900 px-2 py-1 text-white disabled:opacity-50"
                        >
                          Confirm Lost
                        </button>
                        <button
                          type="button"
                          onClick={() => setLostPromptFor(null)}
                          className="rounded border px-2 py-1 hover:bg-slate-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!board[stage]?.length && <p className="px-1 py-2 text-center text-xs text-slate-400">—</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
