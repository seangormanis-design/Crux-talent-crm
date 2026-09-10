import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DuplicateWarningModal from "../components/DuplicateWarningModal";
import CvParsePanel from "../components/CvParsePanel";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";
import InlineField from "../components/InlineField";

interface Person {
  id: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  name: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  location?: string;
  currentTitle?: string;
  jobTitle?: string;
  archivedAt?: string | null;
  createdAt?: string;
  company?: { name: string } | null;
  currentEmployer?: { name: string } | null;
  interactions?: { occurredAt: string }[];
  skills?: { skill: { id: string; name: string } }[];
  jobApplications?: { stage: string; job: { title: string } }[];
}

function employerOf(p: Person): string {
  return (p.personType === "CANDIDATE" ? p.currentEmployer?.name : p.company?.name) ?? "—";
}

function lastNoteOf(p: Person): string {
  const latest = p.interactions?.[0]?.occurredAt;
  return latest ? new Date(latest).toLocaleDateString() : "—";
}

const CANDIDATE_STAGE_OPTIONS = ["SOURCED", "CV_SENT", "REJECTED", "INTERVIEWING", "OFFERED", "PLACED"];

interface ColumnDef {
  key: string;
  label: string;
  defaultVisible: boolean;
}

// "Name" isn't in this list — it's always shown, and isn't optional.
const COLUMNS: ColumnDef[] = [
  { key: "type", label: "Type", defaultVisible: true },
  { key: "title", label: "Title", defaultVisible: true },
  { key: "employer", label: "Employer", defaultVisible: true },
  { key: "email", label: "Email", defaultVisible: true },
  { key: "phone", label: "Phone", defaultVisible: false },
  { key: "linkedin", label: "LinkedIn", defaultVisible: false },
  { key: "location", label: "Location", defaultVisible: false },
  { key: "skills", label: "Skills", defaultVisible: false },
  { key: "stage", label: "Stage", defaultVisible: false },
  { key: "lastNote", label: "Date of last note", defaultVisible: true },
  { key: "dateAdded", label: "Date added", defaultVisible: false },
];

function cellValue(p: Person, key: string): string {
  switch (key) {
    case "type":
      return p.personType === "CANDIDATE" ? "Candidate" : "Client contact";
    case "title":
      return p.currentTitle ?? p.jobTitle ?? "—";
    case "employer":
      return employerOf(p);
    case "email":
      return p.email ?? "—";
    case "phone":
      return p.phone ?? "—";
    case "linkedin":
      return p.linkedinUrl ?? "—";
    case "location":
      return p.location ?? "—";
    case "skills":
      return p.skills?.map((s) => s.skill.name).join(", ") || "—";
    case "stage": {
      const latest = p.jobApplications?.[0];
      return latest ? `${latest.stage.replaceAll("_", " ")} (${latest.job.title})` : "—";
    }
    case "lastNote":
      return lastNoteOf(p);
    case "dateAdded":
      return p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—";
    default:
      return "—";
  }
}

// Raw comparable value for sorting — dates/text lowercased so sort order
// matches what's actually displayed, not incidental casing.
function sortValue(p: Person, key: string): string {
  if (key === "name") return p.name.toLowerCase();
  if (key === "lastNote") return p.interactions?.[0]?.occurredAt ?? "";
  if (key === "dateAdded") return p.createdAt ?? "";
  if (key === "stage") return p.jobApplications?.[0]?.stage ?? "";
  return cellValue(p, key).toLowerCase();
}

interface ListPrefs {
  personType: string;
  skillId: string;
  location: string;
  companyId: string;
  stage: string;
  showArchived: boolean;
  visibleColumns: string[];
  sortKey: string;
  sortDir: "asc" | "desc";
}

const PREFS_STORAGE_KEY = "crux.peopleList.prefs.v1";

const DEFAULT_PREFS: ListPrefs = {
  personType: "",
  skillId: "",
  location: "",
  companyId: "",
  stage: "",
  showArchived: false,
  visibleColumns: COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
  sortKey: "name",
  sortDir: "asc",
};

function loadPrefs(): ListPrefs {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [prefs, setPrefs] = useState<ListPrefs>(loadPrefs);
  const [skillOptions, setSkillOptions] = useState<{ id: string; name: string }[]>([]);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [newType, setNewType] = useState<"CANDIDATE" | "CLIENT_CONTACT">("CANDIDATE");
  const [duplicateMatches, setDuplicateMatches] = useState<any[] | null>(null);
  const navigate = useNavigate();

  function load(query = q, filters: ListPrefs = prefs) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.personType) params.set("personType", filters.personType);
    if (filters.skillId) params.set("skillId", filters.skillId);
    if (filters.location) params.set("location", filters.location);
    if (filters.companyId) params.set("companyId", filters.companyId);
    if (filters.stage) params.set("stage", filters.stage);
    if (filters.showArchived) params.set("includeArchived", "true");
    api.get<Person[]>(`/api/people?${params.toString()}`).then(setPeople);
  }

  // Any change to a server-side filter re-fetches; sort/column-visibility
  // changes are purely client-side and don't need a round-trip.
  function updateFilters(patch: Partial<ListPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      load(q, next);
      return next;
    });
  }

  function updatePrefsOnly(patch: Partial<ListPrefs>) {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => load(), []);
  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/api/skills").then(setSkillOptions);
    api.get<{ id: string; name: string }[]>("/api/companies").then(setCompanyOptions);
  }, []);
  useEffect(() => {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const sortedPeople = useMemo(() => {
    const arr = [...people];
    arr.sort((a, b) => {
      const av = sortValue(a, prefs.sortKey);
      const bv = sortValue(b, prefs.sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return prefs.sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [people, prefs.sortKey, prefs.sortDir]);

  function toggleSort(key: string) {
    updatePrefsOnly({
      sortKey: key,
      sortDir: prefs.sortKey === key && prefs.sortDir === "asc" ? "desc" : "asc",
    });
  }

  function toggleColumn(key: string) {
    updatePrefsOnly({
      visibleColumns: prefs.visibleColumns.includes(key)
        ? prefs.visibleColumns.filter((k) => k !== key)
        : [...prefs.visibleColumns, key],
    });
  }

  function sortIndicator(key: string) {
    if (prefs.sortKey !== key) return null;
    return <span className="ml-1 text-slate-400">{prefs.sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  function resetCreateForm() {
    setName("");
    setEmail("");
    setPhone("");
    setLinkedinUrl("");
    setShowForm(false);
    setDuplicateMatches(null);
  }

  async function createPerson(linkedPersonId?: string) {
    const person = await api.post<Person>("/api/people", {
      name,
      personType: newType,
      email: email || undefined,
      phone: phone || undefined,
      linkedinUrl: linkedinUrl || undefined,
      linkedPersonId,
    });
    resetCreateForm();
    // Straight to the detail page so any remaining details can be filled
    // in immediately, rather than making the quick-add form longer.
    navigate(`/people/${person.id}`);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const { matches } = await api.post<{ matches: any[] }>("/api/people/check-duplicates", {
      name,
      email: email || undefined,
      phone: phone || undefined,
      linkedinUrl: linkedinUrl || undefined,
    });
    if (matches.length) {
      setDuplicateMatches(matches);
    } else {
      await createPerson();
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">People</h1>
        <div className="flex gap-2">
          <Link to="/import?type=candidate" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Import CSV
          </Link>
          <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            {showForm ? "Cancel" : "New person"}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 space-y-2 rounded border bg-white p-3">
          <div className="flex gap-2">
            <select className="rounded border px-2 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.target.value as any)}>
              <option value="CANDIDATE">Candidate</option>
              <option value="CLIENT_CONTACT">Client contact</option>
            </select>
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Email (optional, helps catch duplicates)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="LinkedIn URL (optional)"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
          </div>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      {duplicateMatches && (
        <DuplicateWarningModal
          candidate={{ name, email, phone, linkedinUrl }}
          matches={duplicateMatches}
          onUseExisting={(personId) => {
            resetCreateForm();
            navigate(`/people/${personId}`);
          }}
          onLinkNew={(personId) => createPerson(personId)}
          onCreateAnyway={() => createPerson()}
          onCancel={() => setDuplicateMatches(null)}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-xs rounded border px-3 py-2 text-sm"
          placeholder="Search name, email, company..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load(e.target.value, prefs);
          }}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={prefs.personType}
          onChange={(e) => updateFilters({ personType: e.target.value })}
        >
          <option value="">All people</option>
          <option value="CANDIDATE">Candidates only</option>
          <option value="CLIENT_CONTACT">Client contacts only</option>
        </select>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={prefs.skillId}
          onChange={(e) => updateFilters({ skillId: e.target.value })}
        >
          <option value="">All skills</option>
          {skillOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          className="w-36 rounded border px-2 py-2 text-sm"
          placeholder="Location"
          value={prefs.location}
          onChange={(e) => updateFilters({ location: e.target.value })}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={prefs.stage}
          onChange={(e) => updateFilters({ stage: e.target.value })}
        >
          <option value="">All stages</option>
          {CANDIDATE_STAGE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={prefs.companyId}
          onChange={(e) => updateFilters({ companyId: e.target.value })}
        >
          <option value="">All companies</option>
          {companyOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            checked={prefs.showArchived}
            onChange={(e) => updateFilters({ showArchived: e.target.checked })}
          />
          Show archived
        </label>

        <div className="relative ml-auto">
          <button
            onClick={() => setShowColumnPicker((s) => !s)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Columns
          </button>
          {showColumnPicker && (
            <>
              <div className="fixed inset-0 z-0" onClick={() => setShowColumnPicker(false)} />
              <div className="absolute right-0 z-10 mt-1 w-48 rounded border bg-white p-2 shadow-lg">
              {COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={prefs.visibleColumns.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              {COLUMNS.filter((c) => prefs.visibleColumns.includes(c.key)).map((col) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none whitespace-nowrap px-3 py-2"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedPeople.map((p) => (
              <tr key={p.id} className={`border-t ${p.archivedAt ? "opacity-50" : ""}`}>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link to={`/people/${p.id}`} className="text-blue-600">
                    {p.name}
                  </Link>
                  {p.archivedAt && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">Archived</span>
                  )}
                </td>
                {COLUMNS.filter((c) => prefs.visibleColumns.includes(c.key)).map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-3 py-2">
                    {col.key === "linkedin" && p.linkedinUrl ? (
                      <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600">
                        Profile
                      </a>
                    ) : (
                      cellValue(p, col.key)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!sortedPeople.length && (
              <tr>
                <td colSpan={prefs.visibleColumns.length + 1} className="px-3 py-6 text-center text-slate-400">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toDateInputValue(iso?: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

function isOverdue(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso) < today;
}

const INTERACTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "VIDEO_MEETING", label: "Video meeting" },
  { value: "FACE_TO_FACE", label: "Face to face meeting" },
  { value: "QUALIFICATION_CALL", label: "Main qualification" },
  { value: "LINKEDIN_MESSAGE", label: "LinkedIn message" },
  { value: "EMAIL", label: "Email" },
  { value: "TEXT", label: "Text" },
];

export function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<any>(null);
  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState("PHONE_CALL");
  const [interactionJobId, setInteractionJobId] = useState("");
  const [interactionCompanyId, setInteractionCompanyId] = useState("");
  const [interactionFollowUpAt, setInteractionFollowUpAt] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  function load() {
    api.get(`/api/people/${id}`).then((p: any) => {
      setPerson(p);
      // Default the quick-log company link to whichever company this person
      // is already associated with, but leave it changeable.
      setInteractionCompanyId((prev) => prev || p.companyId || p.currentEmployerId || "");
    });
  }

  async function saveField(field: string, value: string) {
    await api.patch(`/api/people/${id}`, { [field]: value });
    load();
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/api/companies").then(setCompanies);
  }, []);

  async function logInteraction(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/interactions", {
      personId: id,
      type: interactionType,
      notes: note,
      jobId: interactionJobId || undefined,
      companyId: interactionCompanyId || undefined,
      // Only send followUpAt if the user actually touched it — omitting the
      // key means "leave the existing reminder alone" on the backend.
      ...(interactionFollowUpAt ? { followUpAt: interactionFollowUpAt } : {}),
    });
    setNote("");
    setInteractionFollowUpAt("");
    load();
  }

  async function onToggleArchive() {
    await api.post(`/api/people/${id}/${person.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  if (!person) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      {person.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This person is archived. They're hidden from the default list but nothing has been deleted.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <InlineField
            value={person.name}
            placeholder="Name"
            required
            onSave={(v) => saveField("name", v)}
            displayClassName="text-xl font-semibold -ml-2"
            inputClassName="text-xl font-semibold"
          />
          <p className="ml-2 text-sm text-slate-500">
            {person.personType === "CANDIDATE" ? person.currentTitle : person.jobTitle}
          </p>
        </div>
        <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          {person.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>

      <div className={person.personType === "CANDIDATE" ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : ""}>
      <div className="space-y-6">
        <section className="rounded border bg-white p-4 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <DetailRow label="Email">
              <InlineField
                value={person.email ?? ""}
                placeholder="Add email"
                type="email"
                href={person.email ? `mailto:${person.email}` : undefined}
                onSave={(v) => saveField("email", v)}
              />
            </DetailRow>
            <DetailRow label="Phone">
              <InlineField
                value={person.phone ?? ""}
                placeholder="Add phone"
                onSave={(v) => saveField("phone", v)}
              />
            </DetailRow>
            <DetailRow label="LinkedIn">
              <InlineField
                value={person.linkedinUrl ?? ""}
                placeholder="Add LinkedIn profile"
                href={person.linkedinUrl || undefined}
                onSave={(v) => saveField("linkedinUrl", v)}
              />
            </DetailRow>
            <DetailRow label="Address">
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <InlineField
                  value={person.addressStreet ?? ""}
                  placeholder="Street"
                  onSave={(v) => saveField("addressStreet", v)}
                />
                <InlineField
                  value={person.addressCity ?? ""}
                  placeholder="City"
                  onSave={(v) => saveField("addressCity", v)}
                />
                <InlineField
                  value={person.addressPostcode ?? ""}
                  placeholder="Postcode"
                  onSave={(v) => saveField("addressPostcode", v)}
                />
              </div>
            </DetailRow>
            <DetailRow label="Follow-up reminder">
              <div className="flex items-center gap-2">
                <InlineField
                  value={toDateInputValue(person.followUpAt)}
                  displayValue={
                    person.followUpAt
                      ? new Date(person.followUpAt).toLocaleDateString() + (isOverdue(person.followUpAt) ? " (overdue)" : "")
                      : undefined
                  }
                  type="date"
                  placeholder="Set a date"
                  displayClassName={isOverdue(person.followUpAt ?? "") ? "font-medium text-red-600" : ""}
                  onSave={(v) => saveField("followUpAt", v)}
                />
                <InlineField
                  value={person.followUpNote ?? ""}
                  placeholder="Add a note"
                  onSave={(v) => saveField("followUpNote", v)}
                />
              </div>
            </DetailRow>
          </dl>
        </section>

      {person.personType === "CANDIDATE" && (
        <section className="rounded border bg-white p-3 text-sm">
          <p>
            <strong>Seniority:</strong> {person.seniority ?? "—"} · <strong>Location:</strong> {person.location ?? "—"} ·{" "}
            <strong>Preference:</strong> {person.workPreference ?? "—"}
          </p>
          <p className="mt-1">
            <strong>Motivations:</strong> {person.motivationsText ?? "—"}
          </p>
          <p className="mt-1">
            <strong>Skills:</strong>{" "}
            {person.skills?.map((s: any) => s.skill.name).join(", ") || "—"}
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-medium">Log an interaction</h2>
        <form onSubmit={logInteraction} className="space-y-2 rounded border bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border px-2 py-2 text-sm"
              value={interactionType}
              onChange={(e) => setInteractionType(e.target.value)}
            >
              {INTERACTION_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-2 text-sm"
              value={interactionJobId}
              onChange={(e) => setInteractionJobId(e.target.value)}
            >
              <option value="">No linked job</option>
              {person.jobApplications?.map((jc: any) => (
                <option key={jc.job.id} value={jc.job.id}>
                  {jc.job.title}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-2 text-sm"
              value={interactionCompanyId}
              onChange={(e) => setInteractionCompanyId(e.target.value)}
            >
              <option value="">No linked company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="Notes — press Enter for a new line, click Log to save"
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              Remind me to follow up on
              <input
                type="date"
                className="rounded border px-2 py-1 text-sm"
                value={interactionFollowUpAt}
                onChange={(e) => setInteractionFollowUpAt(e.target.value)}
              />
            </label>
            <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">Log</button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Interaction history</h2>
        <ul className="space-y-1 text-sm">
          {person.interactions?.map((i: any) => (
            <li key={i.id} className="rounded border bg-white p-2">
              <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
              {i.type.replaceAll("_", " ")} — <span className="whitespace-pre-wrap">{i.notes}</span>
            </li>
          ))}
        </ul>
      </section>
      </div>

      {person.personType === "CANDIDATE" && (
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <DocumentPreviewPanel
            label="CV"
            documentType="CANDIDATE_CV"
            documents={person.documents ?? []}
            personId={person.id}
            onChange={load}
          />
          <CvParsePanel
            personId={person.id}
            existingSkills={person.skills?.map((s: any) => s.skill) ?? []}
            onSaved={load}
          />
        </div>
      )}
      </div>
    </div>
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
