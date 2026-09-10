import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";

const CANDIDATE_STAGES = ["SOURCED", "CV_SENT", "REJECTED", "INTERVIEWING", "OFFERED", "PLACED"];

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
              {stage.replaceAll("_", " ")} ({board[stage]?.length ?? 0})
            </div>
            <div className="space-y-2 p-2">
              {board[stage]?.map((pairing) => (
                <div key={pairing.id} className="rounded border p-2 text-xs">
                  <Link to={`/people/${pairing.candidate.id}`} className="font-medium text-blue-600">
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
                        {s.replaceAll("_", " ")}
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
