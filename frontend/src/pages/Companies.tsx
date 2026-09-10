import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

interface Company {
  id: string;
  name: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  companyType?: string;
  addressStreet?: string;
  addressCity?: string;
  addressPostcode?: string;
  relationshipStatus: string;
  notes?: string;
  archivedAt?: string | null;
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const navigate = useNavigate();

  function load(query = q, archived = showArchived) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (archived) params.set("includeArchived", "true");
    api.get<Company[]>(`/api/companies?${params.toString()}`).then(setCompanies);
  }

  useEffect(() => load(), []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const company = await api.post<Company>("/api/companies", { name });
    setName("");
    setShowForm(false);
    // Straight to the detail page so website/LinkedIn/address can be filled
    // in immediately, rather than making the quick-add form itself longer.
    navigate(`/companies/${company.id}`);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        <div className="flex gap-2">
          <Link to="/import?type=company" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Import CSV
          </Link>
          <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            {showForm ? "Cancel" : "New company"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 flex gap-2 rounded border bg-white p-3">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      <div className="mb-4 flex items-center gap-3">
        <input
          className="w-full max-w-sm rounded border px-3 py-2 text-sm"
          placeholder="Search companies..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load(e.target.value, showArchived);
          }}
        />
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              load(q, e.target.checked);
            }}
          />
          Show archived
        </label>
      </div>

      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className={`border-t ${c.archivedAt ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <Link to={`/companies/${c.id}`} className="text-blue-600">
                    {c.name}
                  </Link>
                  {c.archivedAt && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">Archived</span>
                  )}
                </td>
                <td className="px-3 py-2">{c.companyType?.replaceAll("_", " ") ?? "—"}</td>
                <td className="px-3 py-2">{c.relationshipStatus.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  website: "",
  linkedinUrl: "",
  addressStreet: "",
  addressCity: "",
  addressPostcode: "",
};

export function CompanyDetail() {
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get(`/api/companies/${id}`).then((c: any) => {
      setCompany(c);
      setForm({
        name: c.name ?? "",
        website: c.website ?? "",
        linkedinUrl: c.linkedinUrl ?? "",
        addressStreet: c.addressStreet ?? "",
        addressCity: c.addressCity ?? "",
        addressPostcode: c.addressPostcode ?? "",
      });
    });
  }

  useEffect(load, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/companies/${id}`, form);
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onToggleArchive() {
    await api.post(`/api/companies/${id}/${company.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  if (!company) return <p>Loading...</p>;

  const hasAddress = company.addressStreet || company.addressCity || company.addressPostcode;

  return (
    <div className="space-y-6">
      {company.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This company is archived. It's hidden from the default list but nothing has been deleted.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          <p className="text-sm text-slate-500">
            {company.companyType?.replaceAll("_", " ")} · {company.relationshipStatus.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing((e) => !e)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            {editing ? "Cancel" : "Edit details"}
          </button>
          <button
            onClick={onToggleArchive}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            {company.archivedAt ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={onSave} className="space-y-3 rounded border bg-white p-4">
          <Field label="Name">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Website">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="https://..."
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </Field>
          <Field label="LinkedIn company page">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="https://www.linkedin.com/company/..."
              value={form.linkedinUrl}
              onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Street">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.addressStreet}
                onChange={(e) => setForm({ ...form, addressStreet: e.target.value })}
              />
            </Field>
            <Field label="City">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.addressCity}
                onChange={(e) => setForm({ ...form, addressCity: e.target.value })}
              />
            </Field>
            <Field label="Postcode">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.addressPostcode}
                onChange={(e) => setForm({ ...form, addressPostcode: e.target.value })}
              />
            </Field>
          </div>
          <button disabled={saving} className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </form>
      ) : (
        <section className="rounded border bg-white p-4 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <DetailRow label="Website">
              {company.website ? (
                <a href={company.website} target="_blank" rel="noreferrer" className="text-blue-600">
                  {company.website}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="LinkedIn">
              {company.linkedinUrl ? (
                <a href={company.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600">
                  {company.linkedinUrl}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Address">
              {hasAddress
                ? [company.addressStreet, company.addressCity, company.addressPostcode].filter(Boolean).join(", ")
                : "—"}
            </DetailRow>
          </dl>
        </section>
      )}

      {company.notes && <p className="rounded border bg-white p-3 text-sm">{company.notes}</p>}

      <section>
        <h2 className="mb-2 font-medium">Contacts</h2>
        <ul className="space-y-1 text-sm">
          {company.contacts?.map((p: any) => (
            <li key={p.id}>
              <Link to={`/people/${p.id}`} className="text-blue-600">
                {p.name}
              </Link>{" "}
              — {p.jobTitle}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Jobs</h2>
        <ul className="space-y-1 text-sm">
          {company.jobs?.map((j: any) => (
            <li key={j.id}>
              <Link to={`/jobs/${j.id}`} className="text-blue-600">
                {j.title}
              </Link>{" "}
              — {j.stage.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Recent interactions</h2>
        <ul className="space-y-1 text-sm">
          {company.interactions?.map((i: any) => (
            <li key={i.id}>
              {i.type.replaceAll("_", " ")} — {new Date(i.occurredAt).toLocaleString()} —{" "}
              <span className="whitespace-pre-wrap">{i.notes}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
