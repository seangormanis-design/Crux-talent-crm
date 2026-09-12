import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import InlineField from "../components/InlineField";
import { fullName } from "../lib/personName";
import { RECORD_KIND_BORDER_CLASS, RECORD_KIND_TEXT_CLASS } from "../lib/recordColors";

interface Placement {
  id: string;
  feeType: string;
  feeValue: string;
  invoiceStatus: string;
  invoiceRaisedDate?: string | null;
  invoiceDueDate?: string | null;
  paidDate?: string | null;
  startDate: string;
  job: { id: string; title: string; qualityRating: string; company: { name: string } };
  candidate: { id: string; firstName: string; surname?: string };
}

const FEE_TYPE_LABELS: Record<string, string> = {
  PERM_PERCENTAGE: "Permanent (% of salary)",
  CONTRACT_MARGIN: "Contract (margin)",
  DAY_RATE_UPLIFT: "Day rate uplift",
};

const INVOICE_STATUS_OPTIONS = ["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE", "CANCELLED"];

const QUALITY_RATINGS = ["A", "B", "C"];

function toDateInputValue(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function isPastDue(iso?: string | null): boolean {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso) < today;
}

export default function Placements() {
  const [placements, setPlacements] = useState<Placement[]>([]);

  function load() {
    api.get<Placement[]>("/api/placements").then(setPlacements);
  }

  useEffect(load, []);

  async function saveField(id: string, field: string, value: string) {
    await api.patch(`/api/placements/${id}`, { [field]: value });
    load();
  }

  const totalFees = placements.reduce((sum, p) => sum + Number(p.feeValue || 0), 0);

  // Realized fees broken down by the quality rating the job carried — shows
  // how revenue that's actually landed splits across A/B/C, since the rating
  // is meant to reflect confidence in a job converting to a placement.
  const feesByRating = placements.reduce<Record<string, number>>((acc, p) => {
    const rating = p.job?.qualityRating ?? "?";
    acc[rating] = (acc[rating] ?? 0) + Number(p.feeValue || 0);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Placements & fees</h1>
        <div className="text-right text-sm text-slate-500">
          <p>
            {placements.length} placement{placements.length === 1 ? "" : "s"} · Total fees:{" "}
            <span className="font-medium text-slate-700">
              {totalFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
          {!!placements.length && (
            <p className="text-xs">
              By rating:{" "}
              {QUALITY_RATINGS.map((r) => (
                <span key={r} className="ml-2">
                  {r}: {(feesByRating[r] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Candidate</th>
              <th className="px-3 py-2">Job</th>
              <th className="px-3 py-2">Rating</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Fee type</th>
              <th className="px-3 py-2">Fee value</th>
              <th className="px-3 py-2">Start date</th>
              <th className="px-3 py-2">Invoice raised</th>
              <th className="px-3 py-2">Invoice due</th>
              <th className="px-3 py-2">Payment status</th>
              <th className="px-3 py-2">Paid date</th>
            </tr>
          </thead>
          <tbody>
            {placements.map((p) => {
              const unpaidOverdue =
                p.invoiceStatus !== "PAID" && p.invoiceStatus !== "CANCELLED" && isPastDue(p.invoiceDueDate);
              return (
                <tr key={p.id} className={`border-t border-l-4 ${RECORD_KIND_BORDER_CLASS.CANDIDATE}`}>
                  <td className="whitespace-nowrap px-3 py-2">
                    {p.candidate ? (
                      <Link to={`/people/${p.candidate.id}`} className={RECORD_KIND_TEXT_CLASS.CANDIDATE}>
                        {fullName(p.candidate)}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link to={`/jobs/${p.job.id}`} className="text-blue-600">
                      {p.job?.title}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{p.job?.qualityRating}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{p.job?.company?.name}</td>
                  <td className="whitespace-nowrap px-3 py-2">{FEE_TYPE_LABELS[p.feeType] ?? p.feeType.replaceAll("_", " ")}</td>
                  <td className="whitespace-nowrap px-3 py-2">{p.feeValue}</td>
                  <td className="whitespace-nowrap px-3 py-2">{new Date(p.startDate).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <InlineField
                      value={toDateInputValue(p.invoiceRaisedDate)}
                      displayValue={p.invoiceRaisedDate ? new Date(p.invoiceRaisedDate).toLocaleDateString() : undefined}
                      type="date"
                      placeholder="Not raised"
                      onSave={(v) => saveField(p.id, "invoiceRaisedDate", v)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <InlineField
                      value={toDateInputValue(p.invoiceDueDate)}
                      displayValue={p.invoiceDueDate ? new Date(p.invoiceDueDate).toLocaleDateString() : undefined}
                      type="date"
                      placeholder="Set due date"
                      displayClassName={unpaidOverdue ? "font-medium text-red-600" : ""}
                      onSave={(v) => saveField(p.id, "invoiceDueDate", v)}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <select
                      className={`rounded border-none bg-transparent px-1 py-1 hover:bg-slate-100 ${
                        unpaidOverdue ? "font-medium text-red-600" : ""
                      }`}
                      value={p.invoiceStatus}
                      onChange={(e) => saveField(p.id, "invoiceStatus", e.target.value)}
                    >
                      {INVOICE_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <InlineField
                      value={toDateInputValue(p.paidDate)}
                      displayValue={p.paidDate ? new Date(p.paidDate).toLocaleDateString() : undefined}
                      type="date"
                      placeholder="Not paid"
                      onSave={(v) => saveField(p.id, "paidDate", v)}
                    />
                  </td>
                </tr>
              );
            })}
            {!placements.length && (
              <tr>
                <td colSpan={11} className="px-3 py-6 text-center text-slate-400">
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
