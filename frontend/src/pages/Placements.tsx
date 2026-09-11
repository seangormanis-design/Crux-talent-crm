import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";

interface Placement {
  id: string;
  feeType: string;
  feeValue: string;
  invoiceStatus: string;
  startDate: string;
  job: { id: string; title: string; company: { name: string } };
  candidate: { id: string; firstName: string; surname?: string };
}

const FEE_TYPE_LABELS: Record<string, string> = {
  PERM_PERCENTAGE: "Permanent (% of salary)",
  CONTRACT_MARGIN: "Contract (margin)",
  DAY_RATE_UPLIFT: "Day rate uplift",
};

export default function Placements() {
  const [placements, setPlacements] = useState<Placement[]>([]);

  useEffect(() => {
    api.get<Placement[]>("/api/placements").then(setPlacements);
  }, []);

  const totalFees = placements.reduce((sum, p) => sum + Number(p.feeValue || 0), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Placements & fees</h1>
        <p className="text-sm text-slate-500">
          {placements.length} placement{placements.length === 1 ? "" : "s"} · Total fees:{" "}
          <span className="font-medium text-slate-700">
            {totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </p>
      </div>
      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Fee type</th>
              <th className="px-3 py-2">Fee value</th>
              <th className="px-3 py-2">Invoice status</th>
              <th className="px-3 py-2">Start date</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  {p.candidate ? (
                    <Link to={`/people/${p.candidate.id}`} className="text-blue-600">
                      {fullName(p.candidate)}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <Link to={`/jobs/${p.job.id}`} className="text-blue-600">
                    {p.job?.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.job?.company?.name}</td>
                <td className="px-3 py-2">{FEE_TYPE_LABELS[p.feeType] ?? p.feeType.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{p.feeValue}</td>
                <td className="px-3 py-2">{p.invoiceStatus.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{new Date(p.startDate).toLocaleDateString()}</td>
              </tr>
            ))}
            {!placements.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  No placements yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
