import { FormEvent, useState } from "react";
import { api } from "../api/client";
import CompanyPicker, { CompanyOption } from "./CompanyPicker";

interface CreatedOpportunity {
  id: string;
  companyId: string | null;
}

// The single Opportunity creation form — used on the BD Funnel page, on a
// Company's Opportunities tab (with the company pre-filled), and when
// approving a suggested Opportunity from Extract Intelligence (with the
// company name and signal pre-filled). There must only ever be this one form.
//
// The company field is deliberately lightweight, not the full CompanyPicker
// flow: picking an existing match links a real Company as usual, but typing
// a name that doesn't match anything is kept as free text (prospectCompanyName)
// rather than immediately creating a Company record — see CLAUDE.md's BD
// prospecting layer rule. No full Company record is required until the
// Opportunity is converted automatically at Meeting Booked.
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
  const [companyText, setCompanyText] = useState(initialCompany?.name ?? initialCompanyQuery ?? "");
  const [title, setTitle] = useState(initialTitle ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!company && !companyText.trim()) {
      setError("Enter the company this opportunity is with (an existing match, or just a name).");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const opportunity = await api.post<CreatedOpportunity>("/api/opportunities", {
        companyId: company?.id,
        companyName: company ? undefined : companyText.trim(),
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
        onQueryChange={setCompanyText}
        initialQuery={initialCompanyQuery}
        allowCreate={false}
        placeholder="Company name — existing or a new prospect"
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
