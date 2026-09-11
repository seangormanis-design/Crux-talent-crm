import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DuplicateWarningModal from "../components/DuplicateWarningModal";
import CvReviewPanel from "../components/CvReviewPanel";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";
import InlineField from "../components/InlineField";
import SkillPicker from "../components/SkillPicker";
import RoleTypePicker from "../components/RoleTypePicker";
import LinkPersonModal from "../components/LinkPersonModal";
import ReflectionPanel from "../components/ReflectionPanel";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import CompanyPicker, { CompanyOption } from "../components/CompanyPicker";
import { fullName } from "../lib/personName";

interface Person {
  id: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  firstName: string;
  surname?: string;
  workEmail?: string;
  personalEmail?: string;
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
  skills?: { skill: { id: string; name: string }; isPrimary: boolean }[];
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

// "First Name"/"Surname" aren't in this list — they're always shown, as two
// separate sortable columns, and aren't optional.
const COLUMNS: ColumnDef[] = [
  { key: "type", label: "Type", defaultVisible: true },
  { key: "title", label: "Title", defaultVisible: true },
  { key: "employer", label: "Employer", defaultVisible: true },
  { key: "workEmail", label: "Work email", defaultVisible: true },
  { key: "personalEmail", label: "Personal email", defaultVisible: false },
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
    case "workEmail":
      return p.workEmail ?? "—";
    case "personalEmail":
      return p.personalEmail ?? "—";
    case "phone":
      return p.phone ?? "—";
    case "linkedin":
      return p.linkedinUrl ?? "—";
    case "location":
      return p.location ?? "—";
    case "skills":
      return (
        p.skills
          ?.slice()
          .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
          .map((s) => (s.isPrimary ? `★ ${s.skill.name}` : s.skill.name))
          .join(", ") || "—"
      );
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
  if (key === "firstName") return (p.firstName ?? "").toLowerCase();
  if (key === "surname") return (p.surname ?? "").toLowerCase();
  // Kept for backward compatibility with any already-persisted sort
  // preference from before Name split into First Name/Surname columns.
  if (key === "name") return fullName(p).toLowerCase();
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
  sortKey: "firstName",
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
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [seniority, setSeniority] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newSkillIds, setNewSkillIds] = useState<string[]>([]);
  const [newCompany, setNewCompany] = useState<CompanyOption | null>(null);
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
    setFirstName("");
    setSurname("");
    setWorkEmail("");
    setPersonalEmail("");
    setPhone("");
    setLinkedinUrl("");
    setAddressStreet("");
    setAddressCity("");
    setAddressPostcode("");
    setSeniority("");
    setNewLocation("");
    setNewSkillIds([]);
    setNewCompany(null);
    setShowForm(false);
    setDuplicateMatches(null);
  }

  function toggleNewSkill(skillId: string) {
    setNewSkillIds((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  }

  async function createPerson(linkedPersonId?: string) {
    const person = await api.post<Person>("/api/people", {
      firstName,
      surname: surname || undefined,
      personType: newType,
      workEmail: workEmail || undefined,
      personalEmail: personalEmail || undefined,
      phone: phone || undefined,
      linkedinUrl: linkedinUrl || undefined,
      addressStreet: addressStreet || undefined,
      addressCity: addressCity || undefined,
      addressPostcode: addressPostcode || undefined,
      ...(newType === "CANDIDATE"
        ? {
            seniority: seniority || undefined,
            location: newLocation || undefined,
            skillIds: newSkillIds.length ? newSkillIds : undefined,
            currentEmployerId: newCompany?.id || undefined,
          }
        : {
            companyId: newCompany?.id || undefined,
          }),
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
      firstName,
      surname: surname || undefined,
      workEmail: workEmail || undefined,
      personalEmail: personalEmail || undefined,
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
          {showForm ? (
            <button onClick={() => setShowForm(false)} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
              Cancel
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setNewType("CANDIDATE");
                  setNewCompany(null);
                  setShowForm(true);
                }}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Add new Candidate
              </button>
              <button
                onClick={() => {
                  setNewType("CLIENT_CONTACT");
                  setNewCompany(null);
                  setShowForm(true);
                }}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Add new Client Contact
              </button>
            </>
          )}
        </div>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 space-y-4 rounded border bg-white p-3">
          <p className="text-xs font-medium uppercase text-slate-400">
            New {newType === "CANDIDATE" ? "Candidate" : "Client Contact"}
          </p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Surname"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Contact details</p>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Work email (helps catch duplicates)"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
              />
              <input
                type="email"
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Personal email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
              />
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="LinkedIn URL"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
              />
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Street"
                value={addressStreet}
                onChange={(e) => setAddressStreet(e.target.value)}
              />
              <input
                className="w-32 rounded border px-3 py-2 text-sm"
                placeholder="City"
                value={addressCity}
                onChange={(e) => setAddressCity(e.target.value)}
              />
              <input
                className="w-28 rounded border px-3 py-2 text-sm"
                placeholder="Postcode"
                value={addressPostcode}
                onChange={(e) => setAddressPostcode(e.target.value)}
              />
            </div>
          </div>

          {newType === "CANDIDATE" && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Professional details</p>
              <div className="mb-2 flex flex-wrap gap-2">
                <input
                  className="flex-1 rounded border px-3 py-2 text-sm"
                  placeholder="Seniority (e.g. Senior, Lead)"
                  value={seniority}
                  onChange={(e) => setSeniority(e.target.value)}
                />
                <input
                  className="flex-1 rounded border px-3 py-2 text-sm"
                  placeholder="Location"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
                <div className="flex-1">
                  <CompanyPicker
                    value={newCompany}
                    onChange={setNewCompany}
                    placeholder="Current employer — search or add new"
                  />
                </div>
              </div>
              <p className="mb-1 text-xs text-slate-500">Skills (optional — mark primary/secondary later on their record)</p>
              <SkillPicker mode="draft" selectedSkillIds={newSkillIds} onToggle={toggleNewSkill} />
            </div>
          )}

          {newType === "CLIENT_CONTACT" && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Company</p>
              <CompanyPicker value={newCompany} onChange={setNewCompany} placeholder="Search or add a new company" />
            </div>
          )}

          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      {duplicateMatches && (
        <DuplicateWarningModal
          candidate={{ firstName, surname, workEmail, personalEmail, phone, linkedinUrl }}
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
              <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("firstName")}>
                First Name{sortIndicator("firstName")}
              </th>
              <th className="cursor-pointer select-none px-3 py-2" onClick={() => toggleSort("surname")}>
                Surname{sortIndicator("surname")}
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
                    {p.firstName}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link to={`/people/${p.id}`} className="text-blue-600">
                    {p.surname || "—"}
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
                <td colSpan={prefs.visibleColumns.length + 2} className="px-3 py-6 text-center text-slate-400">
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

// Guided template for Qualification Call notes — every section is optional
// (leave anything blank that didn't come up) but gets its own text area so
// nothing gets lost under the wrong heading. Stored as one concatenated,
// clearly-labeled note (not seven separate fields) so it stays one coherent
// record and still reads fine for Extract Intelligence.
const QUALIFICATION_CALL_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "PRESENT", label: "Present", hint: "Thoughts, feelings, pulse" },
  { key: "PAST", label: "Past", hint: "Experience, projects, skills, CV" },
  { key: "FUTURE", label: "Future", hint: "Motivations, plans, desires, what matters most" },
  { key: "AOB", label: "AOB", hint: "Salary, notice period, visa status" },
  {
    key: "THREATS",
    label: "Threats",
    hint: "Life-changing moments, other job offers, promotions, projects — anything that could derail a placement",
  },
  { key: "LEADS", label: "Leads", hint: "Names of other people worth targeting, market intel, company signals" },
  { key: "PERSONAL_INFO", label: "Personal info", hint: "Hobbies, family, personal context worth remembering" },
];

function buildQualificationCallNotes(sections: Record<string, string>): string {
  return QUALIFICATION_CALL_SECTIONS.map((s) => {
    const text = sections[s.key]?.trim();
    return text ? `${s.label.toUpperCase()}:\n${text}` : null;
  })
    .filter(Boolean)
    .join("\n\n");
}

function IntelligenceSummary({ intelligence }: { intelligence: any }) {
  const sections = [
    { label: "People mentioned", items: intelligence.peopleMentioned ?? [] },
    { label: "Companies mentioned", items: intelligence.companiesMentioned ?? [] },
    { label: "Market signals", items: intelligence.marketSignals ?? [] },
    { label: "Follow-up actions", items: intelligence.followUpActions ?? [] },
    { label: "Notable quotes", items: intelligence.notableQuotes ?? [] },
  ].filter((s) => s.items.length > 0);

  if (!sections.length) {
    return (
      <p className="mt-1 rounded bg-slate-50 p-2 text-xs text-slate-400">
        Nothing extracted — the notes didn't contain anything for these categories.
      </p>
    );
  }

  return (
    <div className="mt-1 space-y-1.5 rounded bg-slate-50 p-2 text-xs">
      {sections.map((s) => (
        <div key={s.label}>
          <p className="font-medium text-slate-600">{s.label}</p>
          <ul className="ml-3 list-disc text-slate-600">
            {s.items.map((item: string, i: number) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<any>(null);
  const [note, setNote] = useState("");
  const [qualificationSections, setQualificationSections] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState("");
  const [interactionType, setInteractionType] = useState("PHONE_CALL");
  const [interactionJobId, setInteractionJobId] = useState("");
  const [interactionCompanyId, setInteractionCompanyId] = useState("");
  const [interactionFollowUpAt, setInteractionFollowUpAt] = useState("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [confirmingAnonymize, setConfirmingAnonymize] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [pendingCvFile, setPendingCvFile] = useState<File | null>(null);

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

  async function saveRoleTypes(roleTypeIds: string[]) {
    await api.patch(`/api/people/${id}`, { roleTypeIds });
    load();
  }

  useEffect(load, [id]);
  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/api/companies").then(setCompanies);
  }, []);

  async function logInteraction(e: FormEvent) {
    e.preventDefault();
    const notes =
      interactionType === "QUALIFICATION_CALL" ? buildQualificationCallNotes(qualificationSections) : note;
    await api.post("/api/interactions", {
      personId: id,
      type: interactionType,
      notes,
      jobId: interactionJobId || undefined,
      companyId: interactionCompanyId || undefined,
      ...(interactionType === "QUALIFICATION_CALL" && transcript.trim() ? { transcript: transcript.trim() } : {}),
      // Only send followUpAt if the user actually touched it — omitting the
      // key means "leave the existing reminder alone" on the backend.
      ...(interactionFollowUpAt ? { followUpAt: interactionFollowUpAt } : {}),
    });
    setNote("");
    setQualificationSections({});
    setTranscript("");
    setInteractionFollowUpAt("");
    load();
  }

  function onTranscriptFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setTranscript(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  async function runExtractIntelligence(interactionId: string) {
    setExtractingId(interactionId);
    setExtractError(null);
    try {
      await api.post(`/api/interactions/${interactionId}/extract-intelligence`);
      load();
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtractingId(null);
    }
  }

  async function runReflect(interactionId: string) {
    setReflectingId(interactionId);
    setReflectError(null);
    try {
      await api.post(`/api/interactions/${interactionId}/reflect`);
      load();
    } catch (err) {
      setReflectError(err instanceof Error ? err.message : "Reflection failed");
    } finally {
      setReflectingId(null);
    }
  }

  async function submitReflectionFeedback(interactionId: string, reaction: "UP" | "DOWN", comment?: string) {
    await api.post(`/api/interactions/${interactionId}/reflection/feedback`, { reaction, comment });
    load();
  }

  async function onToggleArchive() {
    await api.post(`/api/people/${id}/${person.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  async function setPrimaryLink() {
    await api.post(`/api/people/${id}/set-primary-link`);
    load();
  }

  async function unlink() {
    await api.post(`/api/people/${id}/unlink`);
    load();
  }

  async function anonymizePerson() {
    setAnonymizing(true);
    try {
      await api.post(`/api/people/${id}/anonymize`);
      setConfirmingAnonymize(false);
      load();
    } finally {
      setAnonymizing(false);
    }
  }

  if (!person) return <p>Loading...</p>;

  const linkTargetType = person.personType === "CANDIDATE" ? "CLIENT_CONTACT" : "CANDIDATE";

  return (
    <div className="space-y-6">
      {person.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This person is archived. They're hidden from the default list but nothing has been deleted.
        </div>
      )}

      {person.linkedPerson ? (
        <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          <p>
            Also linked to{" "}
            <Link to={`/people/${person.linkedPerson.id}`} className="font-medium text-blue-700 underline">
              {fullName(person.linkedPerson)}
            </Link>{" "}
            ({person.linkedPerson.personType === "CANDIDATE" ? "Candidate" : "Client contact"})
            {person.isPrimaryLink && " — this is their primary role"}
          </p>
          <div className="flex shrink-0 gap-2">
            {!person.isPrimaryLink && (
              <button onClick={setPrimaryLink} className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-white">
                Make this the primary role
              </button>
            )}
            <button onClick={unlink} className="rounded border border-blue-300 px-2 py-1 text-xs hover:bg-white">
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowLinkModal(true)}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          Link to existing {linkTargetType === "CANDIDATE" ? "candidate" : "client contact"}
        </button>
      )}

      {showLinkModal && (
        <LinkPersonModal
          personId={person.id}
          targetType={linkTargetType}
          onLinked={() => {
            setShowLinkModal(false);
            load();
          }}
          onCancel={() => setShowLinkModal(false)}
        />
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <InlineField
              value={person.firstName}
              placeholder="First name"
              required
              onSave={(v) => saveField("firstName", v)}
              displayClassName="text-xl font-semibold -ml-2"
              inputClassName="text-xl font-semibold"
            />
            <InlineField
              value={person.surname ?? ""}
              placeholder="Surname"
              onSave={(v) => saveField("surname", v)}
              displayClassName="text-xl font-semibold"
              inputClassName="text-xl font-semibold"
            />
          </div>
          <p className="ml-2 text-sm text-slate-500">
            {person.personType === "CANDIDATE" ? person.currentTitle : person.jobTitle}
          </p>
        </div>
        <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          {person.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>

      <section className="rounded border bg-white p-4 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <DetailRow label="Work email">
              <InlineField
                value={person.workEmail ?? ""}
                placeholder="Add work email"
                type="email"
                href={person.workEmail ? `mailto:${person.workEmail}` : undefined}
                onSave={(v) => saveField("workEmail", v)}
              />
            </DetailRow>
            <DetailRow label="Personal email">
              <InlineField
                value={person.personalEmail ?? ""}
                placeholder="Add personal email"
                type="email"
                href={person.personalEmail ? `mailto:${person.personalEmail}` : undefined}
                onSave={(v) => saveField("personalEmail", v)}
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
            <DetailRow label="Source">
              <select
                className="w-full rounded border-none bg-transparent px-2 py-1 text-sm hover:bg-slate-100"
                value={person.source ?? ""}
                onChange={(e) => saveField("source", e.target.value)}
              >
                <option value="">—</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="REFERRAL">Referral</option>
                <option value="INBOUND">Inbound</option>
                <option value="SOURCED">Sourced</option>
                <option value="OTHER">Other</option>
              </select>
            </DetailRow>
            <DetailRow label="GDPR consent">
              <div className="flex items-center gap-2">
                <label className="flex shrink-0 items-center gap-1.5 px-2 py-1">
                  <input
                    type="checkbox"
                    checked={!!person.gdprConsent}
                    onChange={async (e) => {
                      await api.patch(`/api/people/${id}`, { gdprConsent: e.target.checked });
                      load();
                    }}
                  />
                  Consent given
                </label>
                <InlineField
                  value={person.gdprConsentNote ?? ""}
                  placeholder="e.g. how/when consent was given"
                  onSave={(v) => saveField("gdprConsentNote", v)}
                />
              </div>
            </DetailRow>
            <DetailRow label="Lawful basis">
              <InlineField
                value={person.lawfulBasisNote ?? ""}
                placeholder="e.g. legitimate interest, contract"
                onSave={(v) => saveField("lawfulBasisNote", v)}
              />
            </DetailRow>
            <DetailRow label="Retention review date">
              <InlineField
                value={toDateInputValue(person.retentionReviewAt)}
                displayValue={person.retentionReviewAt ? new Date(person.retentionReviewAt).toLocaleDateString() : undefined}
                type="date"
                placeholder="Set a review date"
                onSave={(v) => saveField("retentionReviewAt", v)}
              />
            </DetailRow>
          </dl>

          <div className="mt-3 border-t pt-3">
            {person.isAnonymized ? (
              <p className="text-xs text-slate-400">This record has been anonymized.</p>
            ) : confirmingAnonymize ? (
              <div className="rounded border border-red-300 bg-red-50 p-2 text-xs">
                <p className="mb-2 text-red-700">
                  This permanently scrubs their name, email, phone, and notes. Interaction and pipeline history is
                  kept but is no longer linked to identifiable personal data. This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={anonymizing}
                    onClick={anonymizePerson}
                    className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-50"
                  >
                    {anonymizing ? "Anonymizing..." : "Yes, anonymize this record"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingAnonymize(false)}
                    className="rounded border px-2 py-1 hover:bg-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingAnonymize(true)}
                className="text-xs text-red-600 hover:underline"
              >
                Anonymize this record
              </button>
            )}
          </div>
        </section>

      <div className={person.personType === "CANDIDATE" ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : ""}>
      <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-medium">
          Interaction history
          {person.linkedPerson && <span className="ml-1 text-xs font-normal text-slate-400">(combined with linked record)</span>}
        </h2>
        {extractError && <p className="mb-2 text-sm text-red-600">{extractError}</p>}
        {reflectError && <p className="mb-2 text-sm text-red-600">{reflectError}</p>}
        <ul className="space-y-1 text-sm">
          {(person.combinedInteractions ?? person.interactions)?.map((i: any) => (
            <li key={i.id} className="rounded border bg-white p-2">
              <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
              {i.type.replaceAll("_", " ")} — <span className="whitespace-pre-wrap">{i.notes}</span>
              {i.transcript && (
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">transcript attached</span>
              )}
              {person.linkedPerson && i.sourcePersonId === person.linkedPerson.id && (
                <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">
                  via {fullName(person.linkedPerson)}
                </span>
              )}
              {i.notes?.trim() && (
                <div>
                  {i.intelligence && <IntelligenceSummary intelligence={i.intelligence} />}
                  <button
                    type="button"
                    disabled={extractingId === i.id}
                    onClick={() => runExtractIntelligence(i.id)}
                    className="mt-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {extractingId === i.id
                      ? "Extracting..."
                      : i.intelligence
                        ? "Re-extract intelligence"
                        : "Extract Intelligence"}
                  </button>
                  {i.type === "QUALIFICATION_CALL" && (
                    <ReflectionPanel
                      reflection={i.reflection}
                      reflecting={reflectingId === i.id}
                      onReflect={() => runReflect(i.id)}
                      onFeedback={(reaction, comment) => submitReflectionFeedback(i.id, reaction, comment)}
                    />
                  )}
                </div>
              )}
            </li>
          ))}
          {!(person.combinedInteractions ?? person.interactions)?.length && (
            <li className="text-slate-400">None yet</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Log an interaction</h2>
        <form onSubmit={logInteraction} className="space-y-2 rounded border bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded border px-2 py-2 text-sm"
              value={interactionType}
              onChange={(e) => {
                setInteractionType(e.target.value);
                setNote("");
                setQualificationSections({});
                setTranscript("");
              }}
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
          {interactionType === "QUALIFICATION_CALL" ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUALIFICATION_CALL_SECTIONS.map((s) => (
                <label key={s.key} className="block text-sm">
                  <span className="mb-0.5 block text-xs font-medium uppercase text-slate-500">{s.label}</span>
                  <span className="mb-1 block text-xs text-slate-400">{s.hint}</span>
                  <textarea
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Leave blank if it didn't come up"
                    rows={3}
                    value={qualificationSections[s.key] ?? ""}
                    onChange={(e) => setQualificationSections((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  />
                </label>
              ))}
              <label className="block text-sm sm:col-span-2">
                <span className="mb-0.5 block text-xs font-medium uppercase text-slate-500">Teams transcript</span>
                <span className="mb-1 block text-xs text-slate-400">
                  Optional — paste it in, or upload the .txt/.vtt file, if one's available. Enables a call reflection
                  based on what was actually said, not just what got written down.
                </span>
                <textarea
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="Paste transcript text here (optional)"
                  rows={3}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                <input
                  type="file"
                  accept=".txt,.vtt"
                  className="mt-1 text-xs"
                  onChange={(e) => e.target.files?.[0] && onTranscriptFile(e.target.files[0])}
                />
              </label>
            </div>
          ) : (
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="Notes — press Enter for a new line, click Log to save"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
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

        <section className="rounded border bg-white p-3 text-sm">
          <h2 className="mb-2 font-medium">Tags</h2>
          <TagPicker
            taggableType="PERSON"
            taggableId={person.id}
            attachedLinks={person.tags ?? []}
            onChange={load}
          />
        </section>

        <section className="rounded border bg-white p-3 text-sm">
          <h2 className="mb-2 font-medium">Custom fields</h2>
          <CustomFieldsPanel taggableType="PERSON" taggableId={person.id} />
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
            {person.skills?.length
              ? [...person.skills]
                  .sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary))
                  .map((s: any) => (s.isPrimary ? `★ ${s.skill.name}` : s.skill.name))
                  .join(", ")
              : "—"}
          </p>
        </section>
      )}

      {person.personType === "CANDIDATE" && (
        <section className="rounded border bg-white p-3 text-sm">
          <h2 className="mb-2 font-medium">Role Type</h2>
          <p className="mb-2 text-xs text-slate-500">
            Select every role type that applies — a candidate can hold more than one.
          </p>
          <RoleTypePicker
            selectedIds={(person.roleTypes ?? []).map((rt: any) => rt.id)}
            onSave={saveRoleTypes}
          />
        </section>
      )}

      {person.personType === "CANDIDATE" && (
        <section className="rounded border bg-white p-3 text-sm">
          <h2 className="mb-2 font-medium">Skills</h2>
          <p className="mb-2 text-xs text-slate-500">
            Tick a skill to assign it. Mark up to 5 as Primary — their real specialisms — the rest count as Secondary.
          </p>
          <SkillPicker
            mode="person"
            personId={person.id}
            assigned={(person.skills ?? []).map((s: any) => ({ skillId: s.skill.id, isPrimary: s.isPrimary }))}
            onChange={load}
          />
        </section>
      )}
      </div>

      {person.personType === "CANDIDATE" && (
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {pendingCvFile ? (
            <section className="rounded border bg-white p-4">
              <h2 className="mb-2 font-medium">CV</h2>
              <CvReviewPanel
                file={pendingCvFile}
                personId={person.id}
                existingDocId={person.documents?.find((d: any) => d.type === "CANDIDATE_CV")?.id}
                existingSkills={person.skills?.map((s: any) => s.skill) ?? []}
                onDone={() => {
                  setPendingCvFile(null);
                  load();
                }}
                onCancel={() => setPendingCvFile(null)}
              />
            </section>
          ) : (
            <DocumentPreviewPanel
              label="CV"
              documentType="CANDIDATE_CV"
              documents={person.documents ?? []}
              personId={person.id}
              onChange={load}
              onFileSelected={setPendingCvFile}
            />
          )}
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
