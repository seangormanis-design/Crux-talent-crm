import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";
import { RECORD_KIND_BORDER_CLASS, RECORD_KIND_TEXT_CLASS } from "../lib/recordColors";

const STAGE_LABELS: Record<string, string> = {
  SHORTLISTED: "Shortlisted",
  CV_SENT: "CV Sent",
  FIRST_INTERVIEW: "1st Interview",
  FURTHER_INTERVIEWS: "Further Interviews",
  OFFERED: "Offered",
  PLACED: "Placed",
  REJECTED: "Rejected",
};
const CANDIDATE_STAGES = Object.keys(STAGE_LABELS);

interface Pairing {
  id: string;
  stage: string;
  candidate: { id: string; firstName: string; surname?: string };
  job: { id: string; title: string; company: { name: string } };
}

export default function Pipeline() {
  const [board, setBoard] = useState<Record<string, Pairing[]>>({});

  function load() {
    api.get<Record<string, Pairing[]>>("/api/pipeline/board").then(setBoard);
  }

  useEffect(load, []);

  async function moveStage(id: string, stage: string) {
    await api.post(`/api/pipeline/${id}/stage`, { stage });
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Candidate pipeline</h1>
      <div className="flex gap-3 overflow-x-auto">
        {CANDIDATE_STAGES.map((stage) => (
          <div key={stage} className="w-64 shrink-0 rounded border bg-white">
            <div className="border-b bg-slate-100 px-3 py-2 text-sm font-medium">
              {STAGE_LABELS[stage]} ({board[stage]?.length ?? 0})
            </div>
            <div className="space-y-2 p-2">
              {board[stage]?.map((pairing) => (
                <div
                  key={pairing.id}
                  className={`rounded border border-l-4 p-2 text-xs ${RECORD_KIND_BORDER_CLASS.CANDIDATE}`}
                >
                  <Link to={`/people/${pairing.candidate.id}`} className={`font-medium ${RECORD_KIND_TEXT_CLASS.CANDIDATE}`}>
                    {fullName(pairing.candidate)}
                  </Link>
                  <p className="text-slate-500">
                    <Link to={`/jobs/${pairing.job.id}`}>{pairing.job.title}</Link> — {pairing.job.company?.name}
                  </p>
                  <select
                    className="mt-1 w-full rounded border px-1 py-1 text-xs"
                    value={pairing.stage}
                    onChange={(e) => moveStage(pairing.id, e.target.value)}
                  >
                    {CANDIDATE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
