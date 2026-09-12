import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { COMPANY_LINK_CLASS, RECORD_KIND_TEXT_CLASS } from "../lib/recordColors";

type ImportKind = "CANDIDATE" | "CLIENT_CONTACT" | "COMPANY";

interface TargetField {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
}

const FIELDS_BY_KIND: Record<ImportKind, TargetField[]> = {
  CANDIDATE: [
    { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"] },
    { key: "surname", label: "Surname", aliases: ["surname", "last name", "lastname", "family name"] },
    { key: "email", label: "Email", aliases: ["email", "email address"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "telephone", "phone number"] },
    { key: "linkedinUrl", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
    { key: "title", label: "Current title", aliases: ["title", "current title", "job title", "role"] },
    { key: "companyName", label: "Current employer", aliases: ["employer", "current employer", "company"] },
    { key: "notes", label: "Notes / motivations", aliases: ["notes", "motivations", "comments"] },
  ],
  CLIENT_CONTACT: [
    { key: "firstName", label: "First name", required: true, aliases: ["first name", "firstname", "given name"] },
    { key: "surname", label: "Surname", aliases: ["surname", "last name", "lastname", "family name"] },
    { key: "email", label: "Email", aliases: ["email", "email address"] },
    { key: "phone", label: "Phone", aliases: ["phone", "mobile", "telephone", "phone number"] },
    { key: "linkedinUrl", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url", "linkedin profile"] },
    { key: "title", label: "Job title", aliases: ["title", "job title", "role"] },
    { key: "companyName", label: "Company", required: true, aliases: ["company", "company name", "employer"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
  ],
  COMPANY: [
    { key: "name", label: "Company name", required: true, aliases: ["name", "company name", "company"] },
    { key: "website", label: "Website", aliases: ["website", "url", "site"] },
    { key: "linkedinUrl", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url", "company page"] },
    { key: "industry", label: "Industry", aliases: ["industry", "sector"] },
    { key: "hqLocation", label: "HQ location", aliases: ["location", "hq", "hq location", "city"] },
    { key: "notes", label: "Notes", aliases: ["notes", "comments"] },
  ],
};

const KIND_LABELS: Record<ImportKind, string> = {
  CANDIDATE: "Candidates",
  CLIENT_CONTACT: "Client contacts",
  COMPANY: "Companies",
};

function guessMapping(headers: string[], fields: TargetField[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());
    // Prefer an exact alias match; fall back to the header containing an
    // alias as a substring (e.g. "LinkedIn Company Page" contains
    // "linkedin"). Deliberately one-directional — matching on "alias
    // contains header" instead would let a short header like "Company"
    // false-match any alias phrase that happens to contain that word.
    let index = normalizedHeaders.findIndex((h) => field.aliases.includes(h));
    if (index === -1) {
      index = normalizedHeaders.findIndex((h) => field.aliases.some((a) => h.includes(a)));
    }
    if (index >= 0) mapping[field.key] = headers[index];
  }
  return mapping;
}

type Step = "choose" | "upload" | "map" | "preview" | "result";

export default function Import() {
  const [searchParams] = useSearchParams();
  const initialKind = (searchParams.get("type")?.toUpperCase() as ImportKind) || null;

  const [kind, setKind] = useState<ImportKind | null>(
    initialKind && FIELDS_BY_KIND[initialKind] ? initialKind : null
  );
  const [step, setStep] = useState<Step>(kind ? "upload" : "choose");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fields = kind ? FIELDS_BY_KIND[kind] : [];

  function chooseKind(k: ImportKind) {
    setKind(k);
    setStep("upload");
  }

  async function onFileSelected(file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const parsed = await api.post<{ headers: string[]; rows: string[][] }>("/api/import/parse", formData);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(guessMapping(parsed.headers, fields));
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that file");
    }
  }

  function mappedRows() {
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      for (const field of fields) {
        const header = mapping[field.key];
        const colIndex = header ? headers.indexOf(header) : -1;
        obj[field.key] = colIndex >= 0 ? row[colIndex] ?? "" : "";
      }
      return obj;
    });
  }

  const requiredFieldsMapped = fields.filter((f) => f.required).every((f) => mapping[f.key]);

  async function confirmImport() {
    if (!kind) return;
    setImporting(true);
    setError(null);
    try {
      const body =
        kind === "COMPANY"
          ? { rows: mappedRows().filter((r) => r.name.trim()) }
          : { personType: kind, rows: mappedRows().filter((r) => r.firstName.trim()) };
      const endpoint = kind === "COMPANY" ? "/api/import/companies" : "/api/import/people";
      const res = await api.post(endpoint, body);
      setResult(res);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function startOver() {
    setKind(null);
    setStep("choose");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    setError(null);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">Import from CSV</h1>
      {error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {step === "choose" && (
        <div className="flex gap-3">
          {(Object.keys(KIND_LABELS) as ImportKind[]).map((k) => (
            <button
              key={k}
              onClick={() => chooseKind(k)}
              className="rounded border bg-white px-4 py-3 text-sm hover:bg-slate-50"
            >
              {KIND_LABELS[k]}
            </button>
          ))}
        </div>
      )}

      {step === "upload" && kind && (
        <div className="rounded border bg-white p-4">
          <p className="mb-3 text-sm text-slate-600">
            Importing: <strong>{KIND_LABELS[kind]}</strong>. Upload a CSV file with a header row.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])}
            className="text-sm"
          />
        </div>
      )}

      {step === "map" && kind && (
        <div className="space-y-4">
          <div className="rounded border bg-white p-4">
            <p className="mb-3 text-sm text-slate-600">
              Map each field to a column from your CSV ({rows.length} row{rows.length === 1 ? "" : "s"} found).
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className="block text-sm">
                  <span className="mb-1 block text-slate-600">
                    {field.label}
                    {field.required ? " *" : ""}
                  </span>
                  <select
                    className="w-full rounded border px-2 py-2 text-sm"
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                  >
                    <option value="">— don't import —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={startOver} className="rounded border px-3 py-2 text-sm hover:bg-slate-100">
              Start over
            </button>
            <button
              disabled={!requiredFieldsMapped}
              onClick={() => setStep("preview")}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded border bg-white p-4">
            <p className="mb-3 text-sm text-slate-600">
              Preview of the first {Math.min(10, rows.length)} of {rows.length} rows, as they'll be imported:
            </p>
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  {fields.map((f) => (
                    <th key={f.key} className="px-2 py-1">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mappedRows()
                  .slice(0, 10)
                  .map((row, i) => (
                    <tr key={i} className="border-t">
                      {fields.map((f) => (
                        <td key={f.key} className="px-2 py-1">
                          {row[f.key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep("map")} className="rounded border px-3 py-2 text-sm hover:bg-slate-100">
              Back to mapping
            </button>
            <button
              disabled={importing}
              onClick={confirmImport}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {importing ? "Importing..." : `Import ${rows.length} row${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-4">
          <div className="rounded border bg-white p-4 text-sm">
            <p className="mb-2 font-medium text-green-700">Created {result.createdCount} record(s).</p>
            {result.duplicates?.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 font-medium text-amber-700">
                  Skipped {result.duplicates.length} row(s) that matched an existing record:
                </p>
                <ul className="space-y-1">
                  {result.duplicates.map((d: any, i: number) => (
                    <li key={i}>
                      "{d.row.name ?? [d.row.firstName, d.row.surname].filter(Boolean).join(" ")}" matched{" "}
                      {d.existingPersonId ? (
                        <Link
                          to={`/people/${d.existingPersonId}`}
                          className={RECORD_KIND_TEXT_CLASS[kind === "CLIENT_CONTACT" ? "CLIENT_CONTACT" : "CANDIDATE"]}
                        >
                          {d.existingPersonName}
                        </Link>
                      ) : (
                        <Link to={`/companies/${d.existingCompanyId}`} className={COMPANY_LINK_CLASS}>
                          existing company
                        </Link>
                      )}
                      {d.matchedOn ? ` (${d.matchedOn.join(", ")})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.errors?.length > 0 && (
              <div>
                <p className="mb-1 font-medium text-red-700">{result.errors.length} row(s) failed:</p>
                <ul className="space-y-1">
                  {result.errors.map((e: any, i: number) => (
                    <li key={i}>
                      "{e.row.name ?? [e.row.firstName, e.row.surname].filter(Boolean).join(" ")}" — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={startOver} className="rounded border px-3 py-2 text-sm hover:bg-slate-100">
              Import another file
            </button>
            <Link
              to={kind === "COMPANY" ? "/companies" : "/people"}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              {kind === "COMPANY" ? "View companies" : "View people"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
