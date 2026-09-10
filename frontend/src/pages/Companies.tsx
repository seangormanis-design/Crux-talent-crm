import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  companyType?: string;
  relationshipStatus: string;
  notes?: string;
}

export function CompaniesList() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  function load(query = "") {
    api.get<Company[]>(`/api/companies${query ? `?q=${encodeURIComponent(query)}` : ""}`).then(setCompanies);
  }

  useEffect(() => load(), []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/companies", { name });
    setName("");
    setShowForm(false);
    load(q);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Companies</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          {showForm ? "Cancel" : "New company"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 flex gap-2 rounded border bg-white p-3">
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      <input
        className="mb-4 w-full max-w-sm rounded border px-3 py-2 text-sm"
        placeholder="Search companies..."
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          load(e.target.value);
        }}
      />

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
              <tr key={c.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/companies/${c.id}`} className="text-blue-600">
                    {c.name}
                  </Link>
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

export function CompanyDetail() {
  const { id } = useParams();
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    api.get(`/api/companies/${id}`).then(setCompany);
  }, [id]);

  if (!company) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{company.name}</h1>
        <p className="text-sm text-slate-500">
          {company.companyType?.replaceAll("_", " ")} · {company.relationshipStatus.replaceAll("_", " ")}
        </p>
      </div>

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
              {i.type.replaceAll("_", " ")} — {new Date(i.occurredAt).toLocaleString()} — {i.notes}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
