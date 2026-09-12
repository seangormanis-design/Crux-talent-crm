import { FormEvent, useState } from "react";
import { api } from "../api/client";
import CompanyPicker, { CompanyOption } from "./CompanyPicker";

interface CreatedOpportunity {
  id: string;
  companyId: string;
}

// The single Opportunity creation form — used on the BD Funnel page, on a
// Company's Opportunities tab (with the company pre-filled), and when
// approving a suggested Opportunity from Extract Intelligence (with the
// company name and signal pre-filled, but not yet resolved to a real
// Company — the CompanyPicker below handles finding or creating it). There
// must only ever be this one form.
export default function OpportunityCreateForm({
  initialCompany,
  initialCompanyQuery,
  initialTitle,
  initialNotes,
  onCreated,
  onCancel,
}: {
  initialCompany?: CompanyOption;
  initialCompanyQuery?: string;
  initialTitle?: string;
  initialNotes?: string;
  onCreated: (opportunity: CreatedOpportunity) => void;
  onCancel?: () => void;
}) {
  const [company, setCompany] = useState<CompanyOption | null>(initialCompany ?? null);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company) {
      setError("Pick or create the company this opportunity is with.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const opportunity = await api.post<CreatedOpportunity>("/api/opportunities", {
        companyId: company.id,
        title,
        notes: notes || undefined,
      });
      onCreated(opportunity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create opportunity");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-3 space-y-2 rounded border bg-white p-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <CompanyPicker
        value={company}
        onChange={setCompany}
        initialQuery={initialCompanyQuery}
        placeholder="Search or add a new company"
      />
      <input
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Opportunity title (e.g. 'Finance dept expansion')"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus={!!initialCompany}
      />
      <textarea
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <button disabled={creating} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">
          {creating ? "Creating..." : "Create opportunity"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
