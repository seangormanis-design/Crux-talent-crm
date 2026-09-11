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
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<CompanyOption[]>("/api/companies").then(setCompanies);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const job = await api.post<CreatedJob>("/api/jobs", { title, companyId });
      onCreated(job);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-4 flex gap-2 rounded border bg-white p-3">
      <select
        className="rounded border px-2 py-2 text-sm"
        value={companyId}
        onChange={(e) => setCompanyId(e.target.value)}
        required
      >
        <option value="">Select company...</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        className="flex-1 rounded border px-3 py-2"
        placeholder="Job title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />
      <button disabled={creating} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
        {creating ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
