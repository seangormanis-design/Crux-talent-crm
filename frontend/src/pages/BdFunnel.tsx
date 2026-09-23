import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import OpportunityCreateForm from "../components/OpportunityCreateForm";
import OpportunityStageControl from "../components/OpportunityStageControl";
import ScheduledEventsPanel, { ScheduledEventRecord } from "../components/ScheduledEventsPanel";
import { COMPANY_LINK_CLASS, RECORD_KIND_BORDER_CLASS } from "../lib/recordColors";
import { summarizeOpportunityNotes } from "../lib/opportunityNotes";

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

// A meeting can only be scheduled once an Opportunity has actually reached
// the Meeting Booked stage.
export const MEETING_STAGE = "MEETING_BOOKED";

export interface Opportunity {
  id: string;
  title: string;
  notes?: string | null;
  stage: string;
  lostReason?: string | null;
  // Lightweight prospecting: company is null until the Opportunity converts
  // (at Meeting Booked) — until then, prospectCompanyName is all there is.
  company?: { id: string; name: string; contacts?: { id: string; firstName: string; surname?: string }[] } | null;
  prospectCompanyName?: string | null;
  scheduledEvents?: ScheduledEventRecord[];
  targetContacts?: { id: string; convertedPersonId?: string | null }[];
}

// Company name for display — a real Link once converted, otherwise the
// plain prospect text with a marker that no full record exists yet.
export function OpportunityCompanyLabel({ opportunity }: { opportunity: Opportunity }) {
  if (opportunity.company) {
    return (
      <Link to={`/companies/${opportunity.company.id}`} className={`font-medium ${COMPANY_LINK_CLASS}`}>
        {opportunity.company.name}
      </Link>
    );
  }
  return (
    <span className="font-medium text-slate-700">
      {opportunity.prospectCompanyName || "Unnamed prospect"}
      <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-normal uppercase text-slate-500">
        Prospect
      </span>
    </span>
  );
}

export default function BdFunnel() {
  const [board, setBoard] = useState<Record<string, Opportunity[]>>({});
  const [showForm, setShowForm] = useState(false);

  function load() {
    api.get<Record<string, Opportunity[]>>("/api/opportunities/board").then(setBoard);
  }

  useEffect(load, []);

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
                <div
                  key={opp.id}
                  className={`rounded border p-2 text-xs ${
                    opp.company ? `border-l-4 ${RECORD_KIND_BORDER_CLASS.COMPANY}` : "border-dashed border-slate-300"
                  }`}
                >
                  {/* Title is the primary, always-clickable link into this
                      Opportunity's own detail view — where Target Contacts and
                      activity live. It leads visually in both states so there's
                      one consistent, obvious way in, rather than relying on the
                      company name above (which isn't a link at all pre-conversion). */}
                  <Link
                    to={`/opportunities/${opp.id}`}
                    className="block font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:text-slate-600 hover:decoration-slate-400"
                  >
                    {opp.title}
                  </Link>
                  <p>
                    <OpportunityCompanyLabel opportunity={opp} />
                  </p>
                  {opp.notes && <p className="mt-0.5 text-slate-500">{summarizeOpportunityNotes(opp.notes)}</p>}
                  {!!opp.targetContacts?.length && (
                    <p className="mt-0.5 text-slate-400">
                      {opp.targetContacts.length} target contact{opp.targetContacts.length === 1 ? "" : "s"}
                    </p>
                  )}
                  {opp.stage === "LOST" && opp.lostReason && (
                    <p className="mt-1 rounded bg-slate-50 px-1.5 py-1 text-slate-500">Lost: {opp.lostReason}</p>
                  )}

                  <OpportunityStageControl
                    opportunityId={opp.id}
                    stage={opp.stage}
                    onChanged={load}
                    className="mt-1"
                  />

                  {opp.stage === MEETING_STAGE && (
                    <ScheduledEventsPanel
                      events={opp.scheduledEvents ?? []}
                      parentField="opportunityId"
                      parentId={opp.id}
                      contacts={opp.company?.contacts ?? []}
                      noun="meeting"
                      onChange={load}
                    />
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
