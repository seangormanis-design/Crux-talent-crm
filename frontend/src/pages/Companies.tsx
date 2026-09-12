import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import InlineField from "../components/InlineField";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import PersonCreateForm from "../components/PersonCreateForm";
import JobCreateForm from "../components/JobCreateForm";
import RecordTypeDot from "../components/RecordTypeDot";
import RecordTypeBadge from "../components/RecordTypeBadge";
import { fullName } from "../lib/personName";
import { COMPANY_LINK_CLASS, RECORD_KIND_BORDER_CLASS, personLinkClass, personRecordKind } from "../lib/recordColors";

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
              <tr
                key={c.id}
                className={`border-t border-l-4 ${RECORD_KIND_BORDER_CLASS.COMPANY} ${c.archivedAt ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2">
                  <Link to={`/companies/${c.id}`} className={COMPANY_LINK_CLASS}>
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

const COMPANY_TABS = ["Contacts", "Candidates", "Jobs", "Placements", "Interactions"] as const;
type CompanyTab = (typeof COMPANY_TABS)[number];

export function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<CompanyTab>("Contacts");
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [showClosedJobs, setShowClosedJobs] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

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
    return [...contacts].sort(byLastInteractionDesc);
  }, [company]);

  const sortedCandidates = useMemo(() => {
    const candidates = company?.employeesAt ?? [];
    return [...candidates].sort(byLastInteractionDesc);
  }, [company]);

  const placements = company?.placements ?? [];
  const totalPlacementFees = placements.reduce((sum: number, p: any) => sum + Number(p.feeValue || 0), 0);

  // Derived fresh from `placements` on every render — no stored/cached
  // aggregate to fall out of sync as placements are added or edited.
  const placementsByYear = useMemo(() => {
    const byYear = new Map<number, { count: number; total: number }>();
    for (const p of placements) {
      const year = new Date(p.startDate).getFullYear();
      const entry = byYear.get(year) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += Number(p.feeValue || 0);
      byYear.set(year, entry);
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  // Every interaction logged against any Contact or Candidate linked to this
  // company, combined into one feed — distinct from the Interactions tab,
  // which only shows interactions logged directly against the Company
  // itself. Covers both sides so a colour-coded dot per row is what tells
  // you, at a glance, whether that entry was with a Client Contact or a
  // Candidate.
  const combinedContactActivity = useMemo(() => {
    const people = [...(company?.contacts ?? []), ...(company?.employeesAt ?? [])];
    const entries = people.flatMap((p: any) => (p.interactions ?? []).map((i: any) => ({ ...i, contact: p })));
    return entries.sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [company]);

  const ACTIVITY_PREVIEW_COUNT = 10;
  const visibleActivity = showAllActivity ? combinedContactActivity : combinedContactActivity.slice(0, ACTIVITY_PREVIEW_COUNT);

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
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              setActiveTab("Jobs");
              setShowAddJob(true);
            }}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
          >
            + Add Job
          </button>
          <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            {company.archivedAt ? "Unarchive" : "Archive"}
          </button>
        </div>
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
              {tab === "Candidates" && sortedCandidates.length > 0 && ` (${sortedCandidates.length})`}
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

      <section className="rounded border bg-white p-3 text-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Activity</h2>
          {combinedContactActivity.length > ACTIVITY_PREVIEW_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllActivity((s) => !s)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showAllActivity ? "Show fewer" : `View all (${combinedContactActivity.length})`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-2 py-1.5">Person</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {visibleActivity.map((i: any) => (
                <tr key={i.id} className="border-t">
                  <td className="px-2 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <RecordTypeDot kind={personRecordKind(i.contact)} />
                      <Link to={`/people/${i.contact.id}`} className={personLinkClass(i.contact)}>
                        {fullName(i.contact)}
                      </Link>
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-500">{i.type.replaceAll("_", " ")}</td>
                  <td className="px-2 py-1.5 text-xs text-slate-400">{new Date(i.occurredAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {!combinedContactActivity.length && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-center text-slate-400">
                    No activity yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
              const linked = linkedRecordOf(p);
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded border border-l-4 px-2 py-1.5 ${RECORD_KIND_BORDER_CLASS.CLIENT_CONTACT}`}
                >
                  <span>
                    <Link to={`/people/${p.id}`} className={personLinkClass(p)}>
                      {fullName(p)}
                    </Link>{" "}
                    {p.jobTitle && <span className="text-slate-500">— {p.jobTitle}</span>}
                    {linked && linked.personType === "CANDIDATE" && (
                      <RecordTypeBadge kind="CANDIDATE" className="ml-2">
                        Also linked as Candidate
                      </RecordTypeBadge>
                    )}
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

      {activeTab === "Candidates" && (
        <section className="rounded border bg-white p-3 text-sm">
          <div className="mb-2">
            <h2 className="font-medium">Candidates here</h2>
            <p className="text-xs text-slate-500">
              Our own candidates who currently work at this company — distinct from Contacts, who we know in a client
              capacity.
            </p>
          </div>
          <ul className="space-y-1">
            {sortedCandidates.map((p: any) => {
              const lastInteraction = p.interactions?.[0]?.occurredAt;
              const linked = linkedRecordOf(p);
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded border border-l-4 px-2 py-1.5 ${RECORD_KIND_BORDER_CLASS.CANDIDATE}`}
                >
                  <span>
                    <Link to={`/people/${p.id}`} className={personLinkClass(p)}>
                      {fullName(p)}
                    </Link>{" "}
                    {p.currentTitle && <span className="text-slate-500">— {p.currentTitle}</span>}
                    {linked && linked.personType === "CLIENT_CONTACT" && (
                      <RecordTypeBadge kind="CLIENT_CONTACT" className="ml-2">
                        Also linked as Client Contact
                      </RecordTypeBadge>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">
                    {lastInteraction ? `Last contacted ${new Date(lastInteraction).toLocaleDateString()}` : "No interactions yet"}
                  </span>
                </li>
              );
            })}
            {!sortedCandidates.length && <li className="text-slate-400">No candidates work here currently</li>}
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
          <h2 className="mb-2 font-medium">Placements</h2>

          {placements.length > 0 && (
            <div className="mb-3 rounded border bg-slate-50 p-3">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Placements</dt>
                  <dd className="text-lg font-medium text-slate-800">{placements.length}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Total fees</dt>
                  <dd className="text-lg font-medium text-slate-800">
                    {totalPlacementFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Average fee</dt>
                  <dd className="text-lg font-medium text-slate-800">
                    {(totalPlacementFees / placements.length).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
              </dl>

              {placementsByYear.length > 1 && (
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="py-1 pr-3">Year</th>
                      <th className="py-1 pr-3">Placements</th>
                      <th className="py-1 pr-3">Total fees</th>
                      <th className="py-1 pr-3">Average fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {placementsByYear.map(([year, stats]) => (
                      <tr key={year} className="border-t border-slate-200">
                        <td className="py-1 pr-3">{year}</td>
                        <td className="py-1 pr-3">{stats.count}</td>
                        <td className="py-1 pr-3">
                          {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-1 pr-3">
                          {(stats.total / stats.count).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          <ul className="space-y-1">
            {placements.map((p: any) => {
              const unpaidOverdue =
                p.invoiceStatus !== "PAID" && p.invoiceStatus !== "CANCELLED" && p.invoiceDueDate && new Date(p.invoiceDueDate) < new Date();
              return (
                <li key={p.id} className="rounded border px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span>
                      {p.candidate ? (
                        <Link to={`/people/${p.candidate.id}`} className={personLinkClass(p.candidate)}>
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
                  </div>
                  <div className={`mt-1 text-xs ${unpaidOverdue ? "font-medium text-red-600" : "text-slate-500"}`}>
                    Payment status: {p.invoiceStatus.replaceAll("_", " ")}
                    {p.invoiceRaisedDate && ` · Invoice raised ${new Date(p.invoiceRaisedDate).toLocaleDateString()}`}
                    {p.invoiceDueDate && ` · Invoice due ${new Date(p.invoiceDueDate).toLocaleDateString()}`}
                    {p.paidDate && ` · Paid ${new Date(p.paidDate).toLocaleDateString()}`}
                  </div>
                </li>
              );
            })}
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

// The linked-record feature stores a single directed edge, so the other
// side could be on either `linkedPerson` or `linkedFrom` depending on which
// record initiated the link.
function linkedRecordOf(p: any): { id: string; personType: string } | null {
  return p.linkedPerson ?? p.linkedFrom?.[0] ?? null;
}

// Most-recently-interacted-with first; never-contacted last.
function byLastInteractionDesc(a: any, b: any): number {
  const aDate = a.interactions?.[0]?.occurredAt;
  const bDate = b.interactions?.[0]?.occurredAt;
  if (!aDate && !bDate) return 0;
  if (!aDate) return 1;
  if (!bDate) return -1;
  return new Date(bDate).getTime() - new Date(aDate).getTime();
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
