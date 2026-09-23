import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";

interface CompanyOption {
  id: string;
  name: string;
}

interface CreatedJob {
  id: string;
}

// The single Job creation form — used both on the Jobs page and anywhere
// else a new Job needs creating (e.g. from a Company's Jobs section, with
// the company pre-filled). There must only ever be this one form.
export default function JobCreateForm({
  initialCompanyId,
  onCreated,
}: {
  initialCompanyId?: string;
  onCreated: (job: CreatedJob) => void;
}) {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "");
  // Free-text alternative to picking an existing company — resolved
  // server-side (exact/normalized match links an existing Company, no
  // match creates a new one), same as Person's currentEmployerName. Wins
  // over companyId when both are set, so filling this in doesn't require
  // clearing the dropdown back to blank first.
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  // No default — the recruiter must actively pick A/B/C, never inherit one
  // silently, so nothing ends up unrated by accident.
  const [qualityRating, setQualityRating] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<CompanyOption[]>("/api/companies").then(setCompanies);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const job = await api.post<CreatedJob>("/api/jobs", {
        title,
        companyId: companyId || undefined,
        companyName: companyName.trim() || undefined,
        qualityRating,
      });
      onCreated(job);
    } finally {
      setCreating(false);
    }
  }

  const hasCompany = !!(companyId || companyName.trim());

  return (
    <form onSubmit={onSubmit} className="mb-4 flex flex-wrap items-center gap-2 rounded border bg-white p-3">
      <select
        className="rounded border px-2 py-2 text-sm"
        value={companyId}
        onChange={(e) => {
          setCompanyId(e.target.value);
          if (e.target.value) setCompanyName("");
        }}
      >
        <option value="">Select company...</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-slate-400">or</span>
      <input
        className="rounded border px-3 py-2 text-sm"
        placeholder="Type a new company name"
        value={companyName}
        onChange={(e) => {
          setCompanyName(e.target.value);
          if (e.target.value) setCompanyId("");
        }}
      />
      <input
        className="flex-1 rounded border px-3 py-2"
        placeholder="Job title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />
      <select
        className="rounded border px-2 py-2 text-sm"
        value={qualityRating}
        onChange={(e) => setQualityRating(e.target.value)}
        required
        title="Your own judgement of how likely this job is to close, and the quality of information you have on it — never calculated"
      >
        <option value="">Quality rating...</option>
        <option value="A">A</option>
        <option value="B">B</option>
        <option value="C">C</option>
      </select>
      <button
        disabled={creating || !hasCompany}
        className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
      >
        {creating ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
