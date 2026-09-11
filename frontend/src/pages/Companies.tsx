import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import InlineField from "../components/InlineField";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import PersonCreateForm from "../components/PersonCreateForm";
import JobCreateForm from "../components/JobCreateForm";
import { fullName } from "../lib/personName";

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

const COMPANY_TABS = ["Contacts", "Jobs", "Placements", "Interactions"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

export function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<CompanyTab>("Contacts");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showClosedJobs, setShowClosedJobs] = useState(false);

  function load() {
    api.get(`/api/companies/${id}`).then(setCompany);
  }

  useEffect(load, [id]);

  async function saveField(field: string, value: string) {
    await api.patch(`/api/companies/${id}`, { [field]: value });
    load();
  }

  async function onToggleArchive() {
    await api.post(`/api/companies/${id}/${company.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  const CLOSED_JOB_STAGES = new Set(["PLACED", "REJECTED"]);

  const { activeJobs, closedJobs } = useMemo(() => {
    const jobs = [...(company?.jobs ?? [])].sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return {
      activeJobs: jobs.filter((j: any) => !CLOSED_JOB_STAGES.has(j.stage)),
      closedJobs: jobs.filter((j: any) => CLOSED_JOB_STAGES.has(j.stage)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const sortedContacts = useMemo(() => {
    const contacts = company?.contacts ?? [];
    return [...contacts].sort((a: any, b: any) => {
      const aDate = a.interactions?.[0]?.occurredAt;
      const bDate = b.interactions?.[0]?.occurredAt;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }, [company]);

  const placements = company?.placements ?? [];
  const totalPlacementFees = placements.reduce((sum: number, p: any) => sum + Number(p.feeValue || 0), 0);

  if (!company) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      {company.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This company is archived. It's hidden from the default list but nothing has been deleted.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <InlineField
            value={company.name}
            placeholder="Company name"
            required
            onSave={(v) => saveField("name", v)}
            displayClassName="text-xl font-semibold -ml-2"
            inputClassName="text-xl font-semibold"
          />
          <p className="ml-2 text-sm text-slate-500">
            {company.companyType?.replaceAll("_", " ")} · {company.relationshipStatus.replaceAll("_", " ")}
          </p>
        </div>
        <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          {company.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>

      <div className="border-b">
        <nav className="-mb-px flex gap-4">
          {COMPANY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab}
              {tab === "Contacts" && sortedContacts.length > 0 && ` (${sortedContacts.length})`}
              {tab === "Jobs" && activeJobs.length + closedJobs.length > 0 && ` (${activeJobs.length + closedJobs.length})`}
              {tab === "Placements" && placements.length > 0 && ` (${placements.length})`}
              {tab === "Interactions" && company.interactions?.length > 0 && ` (${company.interactions.length})`}
            </button>
          ))}
        </nav>
      </div>

      <section className="rounded border bg-white p-4 text-sm">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <DetailRow label="Website">
            <InlineField
              value={company.website ?? ""}
              placeholder="Add website"
              type="url"
              href={company.website || undefined}
              onSave={(v) => saveField("website", v)}
            />
          </DetailRow>
          <DetailRow label="LinkedIn">
            <InlineField
              value={company.linkedinUrl ?? ""}
              placeholder="Add LinkedIn company page"
              href={company.linkedinUrl || undefined}
              onSave={(v) => saveField("linkedinUrl", v)}
            />
          </DetailRow>
          <DetailRow label="Address">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
              <InlineField
                value={company.addressStreet ?? ""}
                placeholder="Street"
                onSave={(v) => saveField("addressStreet", v)}
              />
              <InlineField
                value={company.addressCity ?? ""}
                placeholder="City"
                onSave={(v) => saveField("addressCity", v)}
              />
              <InlineField
                value={company.addressPostcode ?? ""}
                placeholder="Postcode"
                onSave={(v) => saveField("addressPostcode", v)}
              />
            </div>
          </DetailRow>
        </dl>
      </section>

      {company.notes && <p className="rounded border bg-white p-3 text-sm">{company.notes}</p>}

      {activeTab === "Contacts" && (
        <section className="rounded border bg-white p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Contacts</h2>
            <button
              type="button"
              onClick={() => setShowAddContact((s) => !s)}
              className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
            >
              {showAddContact ? "Cancel" : "+ Add contact"}
            </button>
          </div>

          {showAddContact && (
            <PersonCreateForm
              personType="CLIENT_CONTACT"
              initialCompany={{ id: company.id, name: company.name }}
              onCreated={(person) => navigate(`/people/${person.id}`)}
            />
          )}

          <ul className="space-y-1">
            {sortedContacts.map((p: any) => {
              const lastInteraction = p.interactions?.[0]?.occurredAt;
              return (
                <li key={p.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                  <span>
                    <Link to={`/people/${p.id}`} className="text-blue-600">
                      {fullName(p)}
                    </Link>{" "}
                    {p.jobTitle && <span className="text-slate-500">— {p.jobTitle}</span>}
                  </span>
                  <span className="text-xs text-slate-400">
                    {lastInteraction ? `Last contacted ${new Date(lastInteraction).toLocaleDateString()}` : "No interactions yet"}
                  </span>
                </li>
              );
            })}
            {!sortedContacts.length && <li className="text-slate-400">No contacts linked yet</li>}
          </ul>
        </section>
      )}

      {activeTab === "Jobs" && (
        <section className="rounded border bg-white p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Jobs</h2>
            <button
              type="button"
              onClick={() => setShowAddJob((s) => !s)}
              className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
            >
              {showAddJob ? "Cancel" : "+ Add job"}
            </button>
          </div>

          {showAddJob && (
            <JobCreateForm
              initialCompanyId={company.id}
              onCreated={() => {
                setShowAddJob(false);
                load();
              }}
            />
          )}

          <ul className="space-y-1">
            {activeJobs.map((j: any) => (
              <JobRow key={j.id} job={j} />
            ))}
            {!activeJobs.length && !closedJobs.length && <li className="text-slate-400">No jobs linked yet</li>}
            {!activeJobs.length && !!closedJobs.length && <li className="text-slate-400">No active jobs</li>}
          </ul>

          {closedJobs.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowClosedJobs((s) => !s)}
                className="text-xs text-slate-500 hover:underline"
              >
                {showClosedJobs ? "▾" : "▸"} Closed jobs ({closedJobs.length})
              </button>
              {showClosedJobs && (
                <ul className="mt-1 space-y-1">
                  {closedJobs.map((j: any) => (
                    <JobRow key={j.id} job={j} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "Placements" && (
        <section className="rounded border bg-white p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Placements</h2>
            {placements.length > 0 && (
              <p className="text-xs text-slate-500">
                Total fees:{" "}
                <span className="font-medium text-slate-700">
                  {totalPlacementFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>
          <ul className="space-y-1">
            {placements.map((p: any) => (
              <li key={p.id} className="flex items-center justify-between rounded border px-2 py-1.5">
                <span>
                  {p.candidate ? (
                    <Link to={`/people/${p.candidate.id}`} className="text-blue-600">
                      {fullName(p.candidate)}
                    </Link>
                  ) : (
                    "—"
                  )}{" "}
                  —{" "}
                  <Link to={`/jobs/${p.job.id}`} className="text-blue-600">
                    {p.job?.title}
                  </Link>
                </span>
                <span className="text-xs text-slate-400">
                  {p.feeValue} ({p.feeType.replaceAll("_", " ")}) · Placed {new Date(p.startDate).toLocaleDateString()}
                </span>
              </li>
            ))}
            {!placements.length && <li className="text-slate-400">No placements yet</li>}
          </ul>
        </section>
      )}

      {activeTab === "Interactions" && (
        <section className="rounded border bg-white p-3 text-sm">
          <h2 className="mb-2 font-medium">Interactions</h2>
          <ul className="space-y-1">
            {company.interactions?.map((i: any) => (
              <li key={i.id} className="rounded border px-2 py-1.5">
                <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
                {i.type.replaceAll("_", " ")} — <span className="whitespace-pre-wrap">{i.notes}</span>
              </li>
            ))}
            {!company.interactions?.length && <li className="text-slate-400">No interactions yet</li>}
          </ul>
        </section>
      )}

      <section className="rounded border bg-white p-3 text-sm">
        <h2 className="mb-2 font-medium">Tags</h2>
        <TagPicker taggableType="COMPANY" taggableId={company.id} attachedLinks={company.tags ?? []} onChange={load} />
      </section>

      <section className="rounded border bg-white p-3 text-sm">
        <h2 className="mb-2 font-medium">Custom fields</h2>
        <CustomFieldsPanel taggableType="COMPANY" taggableId={company.id} />
      </section>
    </div>
  );
}

function JobRow({ job }: { job: any }) {
  return (
    <li className="flex items-center justify-between rounded border px-2 py-1.5">
      <span>
        <Link to={`/jobs/${job.id}`} className="text-blue-600">
          {job.title}
        </Link>{" "}
        <span className="text-slate-500">— {job.stage.replaceAll("_", " ")}</span>
      </span>
      <span className="text-xs text-slate-400">
        Created {new Date(job.createdAt).toLocaleDateString()}
        {job.stage === "PLACED" && job.placement?.startDate && (
          <> · Placed {new Date(job.placement.startDate).toLocaleDateString()}</>
        )}
      </span>
    </li>
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
