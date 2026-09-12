import { useEffect, useState } from "react";
import { api } from "../api/client";
import PersonCreateForm from "./PersonCreateForm";
import DocumentPreviewPanel from "./DocumentPreviewPanel";
import { fullName } from "../lib/personName";

interface CompanyTermsData {
  id: string;
  feeStructurePercentage: number | string | null;
  feeExceptions: string | null;
  paymentTerms: string | null;
  invoicingContactId: string | null;
  invoicingContact: { id: string; firstName: string; surname?: string | null } | null;
  specialTerms: string | null;
}

interface DocumentVersion {
  id: string;
  versionNo: number;
  fileName: string;
  mimeType?: string | null;
  uploadedAt: string;
  note?: string | null;
}

interface DocumentRecord {
  id: string;
  type: string;
  versions: DocumentVersion[];
}

// The Terms onboarding step for a company (fee structure, payment terms,
// invoicing contact, special terms, Terms of Business document) — reused
// both as the Company page's own "Terms" tab and inside the "set up Terms
// now" prompt that fires the moment an Opportunity is marked Won (see
// OpportunityStageControl.tsx). Self-contained: given just a company id/name
// it fetches and saves its own data, so both call sites can drop it in
// without threading company data through in different shapes.
export default function CompanyTermsPanel({
  companyId,
  companyName,
  onSaved,
}: {
  companyId: string;
  companyName: string;
  onSaved?: () => void;
}) {
  const [terms, setTerms] = useState<CompanyTermsData | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [contacts, setContacts] = useState<{ id: string; firstName: string; surname?: string | null }[]>([]);
  const [showAddContact, setShowAddContact] = useState(false);

  const [feePercentage, setFeePercentage] = useState("");
  const [feeExceptions, setFeeExceptions] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [specialTerms, setSpecialTerms] = useState("");

  function load() {
    api.get<{ terms: CompanyTermsData | null; documents: DocumentRecord[] }>(`/api/companies/${companyId}`).then((c) => {
      setTerms(c.terms ?? null);
      setDocuments(c.documents ?? []);
      setFeePercentage(c.terms?.feeStructurePercentage != null ? String(c.terms.feeStructurePercentage) : "");
      setFeeExceptions(c.terms?.feeExceptions ?? "");
      setPaymentTerms(c.terms?.paymentTerms ?? "");
      setSpecialTerms(c.terms?.specialTerms ?? "");
    });
    api
      .get<{ id: string; firstName: string; surname?: string | null }[]>(
        `/api/people?companyId=${companyId}&personType=CLIENT_CONTACT`
      )
      .then(setContacts);
  }

  useEffect(load, [companyId]);

  async function save(patch: Record<string, unknown>) {
    const updated = await api.patch<CompanyTermsData>(`/api/companies/${companyId}/terms`, patch);
    setTerms(updated);
    onSaved?.();
    return updated;
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs uppercase text-slate-500">Fee Structure (%)</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="w-full rounded border px-2 py-1.5"
            value={feePercentage}
            onChange={(e) => setFeePercentage(e.target.value)}
            onBlur={() => {
              const current = terms?.feeStructurePercentage != null ? String(terms.feeStructurePercentage) : "";
              if (feePercentage !== current) {
                save({ feeStructurePercentage: feePercentage === "" ? null : Number(feePercentage) });
              }
            }}
            placeholder="e.g. 20"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs uppercase text-slate-500">Payment Terms</span>
          <input
            list="crux-payment-terms-presets"
            className="w-full rounded border px-2 py-1.5"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            onBlur={() => paymentTerms !== (terms?.paymentTerms ?? "") && save({ paymentTerms })}
            placeholder="e.g. Net 30"
          />
          <datalist id="crux-payment-terms-presets">
            <option value="Net 30" />
            <option value="Net 60" />
            <option value="Net 90" />
            <option value="Due on receipt" />
          </datalist>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase text-slate-500">Fee Exceptions</span>
        <textarea
          className="w-full rounded border px-2 py-1.5"
          rows={2}
          value={feeExceptions}
          onChange={(e) => setFeeExceptions(e.target.value)}
          onBlur={() => feeExceptions !== (terms?.feeExceptions ?? "") && save({ feeExceptions })}
          placeholder="Special fee arrangements or exceptions (optional)"
        />
      </label>

      <div>
        <span className="mb-1 block text-xs uppercase text-slate-500">Invoicing Contact</span>
        {showAddContact ? (
          <div className="rounded border p-2">
            <PersonCreateForm
              personType="CLIENT_CONTACT"
              initialCompany={{ id: companyId, name: companyName }}
              onCreated={async (person) => {
                setShowAddContact(false);
                await save({ invoicingContactId: person.id });
                load();
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              className="flex-1 rounded border px-2 py-1.5"
              value={terms?.invoicingContactId ?? ""}
              onChange={(e) => save({ invoicingContactId: e.target.value || null })}
            >
              <option value="">No invoicing contact set</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowAddContact(true)}
              className="shrink-0 rounded border px-2 py-1.5 text-xs hover:bg-slate-100"
            >
              + New contact
            </button>
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs uppercase text-slate-500">Special Terms</span>
        <textarea
          className="w-full rounded border px-2 py-1.5"
          rows={2}
          value={specialTerms}
          onChange={(e) => setSpecialTerms(e.target.value)}
          onBlur={() => specialTerms !== (terms?.specialTerms ?? "") && save({ specialTerms })}
          placeholder="Rebate periods, exclusivity, etc. (optional)"
        />
      </label>

      <DocumentPreviewPanel
        label="Terms of Business"
        documentType="TERMS_OF_BUSINESS"
        documents={documents}
        companyId={companyId}
        onChange={load}
      />
    </div>
  );
}
