import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import CvReviewPanel from "../components/CvReviewPanel";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";
import InlineField from "../components/InlineField";
import QualificationExtractionReviewPanel from "../components/QualificationExtractionReviewPanel";
import { QC_SECTION_FIELDS, QcSectionField } from "../lib/qualificationSections";
import SkillPicker from "../components/SkillPicker";
import RoleTypePicker from "../components/RoleTypePicker";
import LinkPersonModal from "../components/LinkPersonModal";
import ReflectionPanel from "../components/ReflectionPanel";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import PersonCreateForm from "../components/PersonCreateForm";
import OpportunityCreateForm from "../components/OpportunityCreateForm";
import CompanyPicker, { CompanyOption } from "../components/CompanyPicker";
import RecordTypeBadge from "../components/RecordTypeBadge";
import RecordTypeDot from "../components/RecordTypeDot";
import { fullName } from "../lib/personName";
import { INTERACTION_TYPE_OPTIONS } from "../lib/interactionTypes";
import {
  COMPANY_LINK_CLASS,
  RECORD_KIND_BORDER_CLASS,
  personLinkClass,
  personRecordKind,
} from "../lib/recordColors";

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

// Candidate-level pipeline stage (JobCandidate.stage) — same set as the
// Job/Pipeline kanban boards.
const CANDIDATE_STAGE_LABELS: Record<string, string> = {
  SHORTLISTED: "Shortlisted",
  CV_SENT: "CV Sent",
  FIRST_INTERVIEW: "1st Interview",
  FURTHER_INTERVIEWS: "Further Interviews",
  OFFERED: "Offered",
  PLACED: "Placed",
  REJECTED: "Rejected",
};
const CANDIDATE_STAGE_OPTIONS = Object.keys(CANDIDATE_STAGE_LABELS);

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
      return latest ? `${CANDIDATE_STAGE_LABELS[latest.stage] ?? latest.stage} (${latest.job.title})` : "—";
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
  skillIds: string[];
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
  skillIds: [],
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
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [showSkillFilter, setShowSkillFilter] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newType, setNewType] = useState<"CANDIDATE" | "CLIENT_CONTACT">("CANDIDATE");
  const navigate = useNavigate();

  function load(query = q, filters: ListPrefs = prefs) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filters.personType) params.set("personType", filters.personType);
    for (const id of filters.skillIds) params.append("skillId", id);
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

  function toggleSkillFilter(skillId: string) {
    const next = prefs.skillIds.includes(skillId)
      ? prefs.skillIds.filter((id) => id !== skillId)
      : [...prefs.skillIds, skillId];
    updateFilters({ skillIds: next });
  }

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
                  setShowForm(true);
                }}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white"
              >
                Add new Candidate
              </button>
              <button
                onClick={() => {
                  setNewType("CLIENT_CONTACT");
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
        <PersonCreateForm
          personType={newType}
          onCreated={(person) => {
            setShowForm(false);
            navigate(`/people/${person.id}`);
          }}
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
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSkillFilter((s) => !s)}
            className={`rounded border px-2 py-2 text-sm ${
              prefs.skillIds.length ? "border-slate-900 bg-slate-900 text-white" : ""
            }`}
          >
            Skills{prefs.skillIds.length > 0 && ` (${prefs.skillIds.length})`}
          </button>
          {showSkillFilter && (
            <div className="absolute left-0 top-full z-10 mt-1 w-72 rounded border bg-white p-2 shadow-lg">
              <SkillPicker mode="draft" selectedSkillIds={prefs.skillIds} onToggle={toggleSkillFilter} />
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                {prefs.skillIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => updateFilters({ skillIds: [] })}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSkillFilter(false)}
                  className="ml-auto rounded bg-slate-900 px-2 py-1 text-xs text-white"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
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
              {CANDIDATE_STAGE_LABELS[s]}
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
              <tr
                key={p.id}
                className={`border-t border-l-4 ${RECORD_KIND_BORDER_CLASS[personRecordKind(p)]} ${p.archivedAt ? "opacity-50" : ""}`}
              >
                <td className="whitespace-nowrap px-3 py-2">
                  <Link to={`/people/${p.id}`} className={personLinkClass(p)}>
                    {p.firstName}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <Link to={`/people/${p.id}`} className={personLinkClass(p)}>
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

function IntelligenceSummary({
  intelligence,
  personId,
  existingSkills,
  onSkillAdded,
}: {
  intelligence: any;
  personId?: string;
  existingSkills?: { skillId: string; isPrimary: boolean }[];
  onSkillAdded?: () => void;
}) {
  const sections = [
    { label: "People mentioned", items: intelligence.peopleMentioned ?? [] },
    { label: "Companies mentioned", items: intelligence.companiesMentioned ?? [] },
    { label: "Market signals", items: intelligence.marketSignals ?? [] },
    { label: "Follow-up actions", items: intelligence.followUpActions ?? [] },
    { label: "Notable quotes", items: intelligence.notableQuotes ?? [] },
  ].filter((s) => s.items.length > 0);

  const suggestedOpportunities: { companyName: string; signal: string }[] = intelligence.suggestedOpportunities ?? [];
  const suggestedSkills: { id: string; name: string }[] = intelligence.suggestedSkills ?? [];

  if (!sections.length && !suggestedOpportunities.length && !suggestedSkills.length) {
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
      {!!suggestedOpportunities.length && (
        <div>
          <p className="font-medium text-slate-600">Suggested opportunities</p>
          <div className="ml-3 space-y-1">
            {suggestedOpportunities.map((s, i) => (
              <SuggestedOpportunityRow key={i} suggestion={s} />
            ))}
          </div>
        </div>
      )}
      {!!suggestedSkills.length && personId && (
        <div>
          <p className="font-medium text-slate-600">Suggested skills</p>
          <div className="ml-3 space-y-1">
            {suggestedSkills.map((s) => (
              <SuggestedSkillRow
                key={s.id}
                skill={s}
                personId={personId}
                existingSkills={existingSkills ?? []}
                onAdded={onSkillAdded ?? (() => {})}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// A candidate skill mentioned in the call notes but not yet tagged, found
// with the same fuzzy/synonym matching CV parsing uses (guessSkills) —
// never saved without approval, same principle as every other Extract
// Intelligence suggestion. "Add" appends it via the real skill-assignment
// endpoint (PUT .../skills, the same one SkillPicker uses), not a shortcut.
function SuggestedSkillRow({
  skill,
  personId,
  existingSkills,
  onAdded,
}: {
  skill: { id: string; name: string };
  personId: string;
  existingSkills: { skillId: string; isPrimary: boolean }[];
  onAdded: () => void;
}) {
  const [status, setStatus] = useState<"pending" | "adding" | "dismissed" | "added">("pending");

  if (status === "dismissed") return null;
  if (status === "added") return <p className="text-green-700">✓ Added {skill.name}</p>;

  async function add() {
    setStatus("adding");
    try {
      await api.put(`/api/people/${personId}/skills`, {
        skills: [...existingSkills, { skillId: skill.id, isPrimary: false }],
      });
      setStatus("added");
      onAdded();
    } catch {
      setStatus("pending");
    }
  }

  return (
    <div className="flex items-center justify-between rounded border bg-white px-2 py-1">
      <span className="text-slate-600">{skill.name}</span>
      <div className="flex gap-3">
        <button type="button" disabled={status === "adding"} onClick={add} className="text-blue-600 hover:underline disabled:opacity-50">
          {status === "adding" ? "Adding..." : "Add"}
        </button>
        <button type="button" onClick={() => setStatus("dismissed")} className="text-slate-400 hover:underline">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// One market signal shaped like a new-business opportunity — nothing is
// auto-created. "Create Opportunity" opens the single Opportunity form
// pre-filled with the suggested company and signal, so the user reviews and
// confirms (picking or creating the company) before anything is saved;
// "Dismiss" just hides it from this view.
function SuggestedOpportunityRow({ suggestion }: { suggestion: { companyName: string; signal: string } }) {
  const [status, setStatus] = useState<"pending" | "creating" | "dismissed" | "created">("pending");

  if (status === "dismissed") return null;

  if (status === "created") {
    return <p className="text-green-700">✓ Opportunity created for {suggestion.companyName}</p>;
  }

  return (
    <div className="rounded border bg-white p-2">
      <p className="text-slate-600">
        <span className="font-medium">{suggestion.companyName}</span> — {suggestion.signal}
      </p>
      {status === "creating" ? (
        <OpportunityCreateForm
          initialCompanyQuery={suggestion.companyName}
          initialTitle={suggestion.signal}
          initialNotes={suggestion.signal}
          onCreated={() => setStatus("created")}
          onCancel={() => setStatus("pending")}
        />
      ) : (
        <div className="mt-1 flex gap-3">
          <button type="button" onClick={() => setStatus("creating")} className="text-blue-600 hover:underline">
            Create Opportunity
          </button>
          <button type="button" onClick={() => setStatus("dismissed")} className="text-slate-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}
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
  const [loggingInteraction, setLoggingInteraction] = useState(false);
  const [logInteractionError, setLogInteractionError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showPromoteForm, setShowPromoteForm] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [expandedTranscriptIds, setExpandedTranscriptIds] = useState<Set<string>>(new Set());
  // Interaction history entries default to collapsed (date/time/type only) —
  // an empty Set here means nothing is expanded until clicked. Independent
  // per entry, so several can be open at once.
  const [expandedInteractionIds, setExpandedInteractionIds] = useState<Set<string>>(new Set());
  const [reflectingId, setReflectingId] = useState<string | null>(null);
  const [reflectError, setReflectError] = useState<string | null>(null);
  const [confirmingAnonymize, setConfirmingAnonymize] = useState(false);
  const [anonymizing, setAnonymizing] = useState(false);
  const [pendingCvFile, setPendingCvFile] = useState<File | null>(null);

  // Qualification Call auto-extraction review — set right after logging a
  // new Qualification Call with a transcript already attached, or after
  // attaching/re-extracting one on an existing interaction. Only one review
  // panel is open at a time.
  const [reviewingInteraction, setReviewingInteraction] = useState<{
    id: string;
    transcript: string;
    existingSections: Partial<Record<QcSectionField, string>>;
  } | null>(null);

  // "Attach transcript" (Feature 2's second trigger point — wiring up the
  // previously-unused POST /:id/transcript) — only one row's form open at a time.
  const [attachingTranscriptId, setAttachingTranscriptId] = useState<string | null>(null);
  const [attachTranscriptDraft, setAttachTranscriptDraft] = useState("");
  const [attachingTranscript, setAttachingTranscript] = useState(false);
  const [attachTranscriptError, setAttachTranscriptError] = useState<string | null>(null);

  function load() {
    api.get(`/api/people/${id}`).then((p: any) => {
      setPerson(p);
      // Default the quick-log company link to whichever company this person
      // is already associated with, but leave it changeable.
      setInteractionCompanyId((prev) => prev || p.companyId || p.currentEmployerId || "");
    });
  }

  async function saveField(field: string, value: string | null) {
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
    // notes is no longer built here for a Qualification Call — the backend
    // computes it server-side from the 7 qc* fields (see interactions.ts),
    // so the single source of truth for that concatenation lives in one
    // place instead of being trusted from whatever the client assembled.
    const trimmedTranscript = transcript.trim();
    const loggedType = interactionType;
    const loggedSections = { ...qualificationSections };
    setLoggingInteraction(true);
    setLogInteractionError(null);
    try {
      const created = await api.post<{ id: string }>("/api/interactions", {
        personId: id,
        type: interactionType,
        ...(interactionType === "QUALIFICATION_CALL" ? qualificationSections : { notes: note }),
        jobId: interactionJobId || undefined,
        companyId: interactionCompanyId || undefined,
        ...(interactionType === "QUALIFICATION_CALL" && trimmedTranscript ? { transcript: trimmedTranscript } : {}),
        // Only send followUpAt if the user actually touched it — omitting the
        // key means "leave the existing reminder alone" on the backend.
        ...(interactionFollowUpAt ? { followUpAt: interactionFollowUpAt } : {}),
      });
      setNote("");
      setQualificationSections({});
      setTranscript("");
      setInteractionFollowUpAt("");
      load();
      // Trigger point 1: a transcript was already attached at creation time.
      if (loggedType === "QUALIFICATION_CALL" && trimmedTranscript) {
        setReviewingInteraction({ id: created.id, transcript: trimmedTranscript, existingSections: loggedSections });
        // The new entry defaults to collapsed like every other one — expand
        // it so the auto-triggered review panel isn't hidden the moment it appears.
        setExpandedInteractionIds((prev) => new Set(prev).add(created.id));
      }
    } catch (err) {
      setLogInteractionError(err instanceof Error ? err.message : "Could not save this interaction");
    } finally {
      setLoggingInteraction(false);
    }
  }

  function onTranscriptFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setTranscript(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  function toggleTranscriptExpanded(interactionId: string) {
    setExpandedTranscriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(interactionId)) next.delete(interactionId);
      else next.add(interactionId);
      return next;
    });
  }

  function toggleInteractionExpanded(interactionId: string) {
    setExpandedInteractionIds((prev) => {
      const next = new Set(prev);
      if (next.has(interactionId)) next.delete(interactionId);
      else next.add(interactionId);
      return next;
    });
  }

  function existingQcSections(i: any): Partial<Record<QcSectionField, string>> {
    return {
      qcPresent: i.qcPresent ?? "",
      qcPast: i.qcPast ?? "",
      qcFuture: i.qcFuture ?? "",
      qcAob: i.qcAob ?? "",
      qcThreats: i.qcThreats ?? "",
      qcLeads: i.qcLeads ?? "",
      qcPersonalInfo: i.qcPersonalInfo ?? "",
    };
  }

  function openExtractionReview(i: any) {
    setReviewingInteraction({ id: i.id, transcript: i.transcript ?? "", existingSections: existingQcSections(i) });
  }

  function onAttachTranscriptFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setAttachTranscriptDraft(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  // Trigger point 2: a transcript arriving after the call was already
  // logged (POST /:id/transcript, previously unused from the frontend) —
  // attaching it also opens the same extraction review as trigger point 1.
  async function attachTranscript(i: any) {
    const trimmed = attachTranscriptDraft.trim();
    if (!trimmed) return;
    setAttachingTranscript(true);
    setAttachTranscriptError(null);
    try {
      await api.post(`/api/interactions/${i.id}/transcript`, { transcript: trimmed });
      setAttachingTranscriptId(null);
      setAttachTranscriptDraft("");
      load();
      openExtractionReview({ ...i, transcript: trimmed });
    } catch (err) {
      setAttachTranscriptError(err instanceof Error ? err.message : "Could not attach transcript");
    } finally {
      setAttachingTranscript(false);
    }
  }

  // Feature 3: edit-after-save for notes/sections/transcript — the one
  // deliberate, tracked exception to interactions being append-only (see
  // PATCH /:id's comment). An empty saved value clears that field.
  async function patchInteraction(interactionId: string, fields: Record<string, string | null>) {
    await api.patch(`/api/interactions/${interactionId}`, fields);
    load();
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
        <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          <p>
            Also linked to{" "}
            <Link to={`/people/${person.linkedPerson.id}`} className={`font-medium underline ${personLinkClass(person.linkedPerson)}`}>
              {fullName(person.linkedPerson)}
            </Link>{" "}
            <RecordTypeBadge kind={personRecordKind(person.linkedPerson)}>
              {person.linkedPerson.personType === "CANDIDATE" ? "Candidate" : "Client Contact"}
            </RecordTypeBadge>
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowLinkModal(true)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Link to existing {linkTargetType === "CANDIDATE" ? "candidate" : "client contact"}
          </button>
          {person.personType === "CANDIDATE" && !showPromoteForm && (
            <button
              onClick={() => setShowPromoteForm(true)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              This person is now also a Client Contact — create linked record
            </button>
          )}
        </div>
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

      {showPromoteForm && (
        <div className="rounded border border-blue-200 bg-blue-50 p-3">
          <p className="mb-2 text-sm text-blue-900">
            Creating a linked Client Contact record for {fullName(person)} — the two records will be connected
            automatically on save.
          </p>
          <PersonCreateForm
            personType="CLIENT_CONTACT"
            initialValues={{
              firstName: person.firstName,
              surname: person.surname ?? "",
              workEmail: person.workEmail ?? "",
              personalEmail: person.personalEmail ?? "",
              phone: person.phone ?? "",
              linkedinUrl: person.linkedinUrl ?? "",
            }}
            linkedPersonId={person.id}
            onCreated={() => {
              setShowPromoteForm(false);
              load();
            }}
          />
          <button
            type="button"
            onClick={() => setShowPromoteForm(false)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <RecordTypeDot kind={personRecordKind(person)} className="h-2.5 w-2.5" />
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
          {person.personType === "CANDIDATE" ? (
            <p className="ml-2 text-sm text-slate-500">{person.currentTitle}</p>
          ) : (
            <div className="ml-2 text-sm text-slate-500">
              <InlineField
                value={person.jobTitle ?? ""}
                placeholder="Add job title"
                onSave={(v) => saveField("jobTitle", v)}
              />
            </div>
          )}
        </div>
        <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          {person.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>

      <section className="rounded border bg-white p-4 text-sm">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            <DetailRow label={person.personType === "CANDIDATE" ? "Current employer" : "Company"}>
              <CompanyLinkField
                company={person.personType === "CANDIDATE" ? person.currentEmployer ?? null : person.company ?? null}
                onSave={(companyId) =>
                  saveField(person.personType === "CANDIDATE" ? "currentEmployerId" : "companyId", companyId)
                }
              />
            </DetailRow>
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
          {(person.combinedInteractions ?? person.interactions)?.map((i: any) => {
            const hasQcSections = QC_SECTION_FIELDS.some((s) => i[s.field]?.trim());
            const isExpanded = expandedInteractionIds.has(i.id);
            return (
            <li key={i.id} className="rounded border bg-white p-2">
              <button
                type="button"
                onClick={() => toggleInteractionExpanded(i.id)}
                className="flex w-full items-center gap-1 text-left"
                aria-expanded={isExpanded}
              >
                <span className="w-3 shrink-0 text-slate-400">{isExpanded ? "▾" : "▸"}</span>
                <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
                {i.type.replaceAll("_", " ")}
                {i.editedAt && (
                  <span
                    className="ml-1 text-xs italic text-slate-400"
                    title={`Edited ${new Date(i.editedAt).toLocaleString()}${i.editedBy?.name ? ` by ${i.editedBy.name}` : ""}`}
                  >
                    (edited)
                  </span>
                )}
                {person.linkedPerson && i.sourcePersonId === person.linkedPerson.id && (
                  <RecordTypeBadge kind={personRecordKind(person.linkedPerson)} className="ml-2">
                    via {fullName(person.linkedPerson)}
                  </RecordTypeBadge>
                )}
              </button>

              {isExpanded && (
              <div className="mt-1">
              {hasQcSections ? (
                <div className="mt-1 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {QC_SECTION_FIELDS.map((s) => (
                    <label key={s.field} className="block">
                      <span className="mb-0.5 block text-xs font-medium uppercase text-slate-500">{s.label}</span>
                      <InlineField
                        value={i[s.field] ?? ""}
                        placeholder="—"
                        multiline
                        rows={2}
                        onSave={(v) => patchInteraction(i.id, { [s.field]: v })}
                      />
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-1">
                  <InlineField
                    value={i.notes ?? ""}
                    placeholder="No notes"
                    multiline
                    rows={3}
                    onSave={(v) => patchInteraction(i.id, { notes: v })}
                  />
                </div>
              )}

              <div className="mt-1">
                {i.transcript ? (
                  <>
                    <button
                      type="button"
                      onClick={() => toggleTranscriptExpanded(i.id)}
                      className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-300"
                    >
                      {expandedTranscriptIds.has(i.id) ? "hide transcript" : "transcript attached"}
                    </button>
                    {i.type === "QUALIFICATION_CALL" && (
                      <button
                        type="button"
                        onClick={() => openExtractionReview(i)}
                        className="ml-2 text-xs text-blue-600 hover:underline"
                      >
                        Re-extract sections
                      </button>
                    )}
                    {expandedTranscriptIds.has(i.id) && (
                      <div className="mt-1 rounded bg-slate-50 p-2">
                        <InlineField
                          value={i.transcript}
                          placeholder="—"
                          multiline
                          rows={6}
                          displayClassName="text-xs text-slate-600"
                          inputClassName="text-xs"
                          onSave={(v) => patchInteraction(i.id, { transcript: v })}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  i.type === "QUALIFICATION_CALL" &&
                  (attachingTranscriptId === i.id ? (
                    <div className="rounded bg-slate-50 p-2">
                      <textarea
                        className="w-full rounded border px-2 py-1.5 text-xs"
                        rows={3}
                        placeholder="Paste transcript text here"
                        value={attachTranscriptDraft}
                        onChange={(e) => setAttachTranscriptDraft(e.target.value)}
                      />
                      <input
                        type="file"
                        accept=".txt,.vtt"
                        className="mt-1 text-xs"
                        onChange={(e) => e.target.files?.[0] && onAttachTranscriptFile(e.target.files[0])}
                      />
                      {attachTranscriptError && <p className="mt-1 text-xs text-red-600">{attachTranscriptError}</p>}
                      <div className="mt-1 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAttachingTranscriptId(null);
                            setAttachTranscriptDraft("");
                            setAttachTranscriptError(null);
                          }}
                          className="rounded border px-2 py-1 text-xs hover:bg-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={attachingTranscript || !attachTranscriptDraft.trim()}
                          onClick={() => attachTranscript(i)}
                          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                        >
                          {attachingTranscript ? "Attaching..." : "Attach & extract"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAttachingTranscriptId(i.id)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Attach transcript
                    </button>
                  ))
                )}
              </div>

              {reviewingInteraction && reviewingInteraction.id === i.id && (
                <QualificationExtractionReviewPanel
                  interactionId={reviewingInteraction.id}
                  transcript={reviewingInteraction.transcript}
                  existingSections={reviewingInteraction.existingSections}
                  onDone={() => {
                    setReviewingInteraction(null);
                    load();
                  }}
                  onDismiss={() => setReviewingInteraction(null)}
                />
              )}

              {i.notes?.trim() && (
                <div>
                  {i.intelligence && (
                    <IntelligenceSummary
                      intelligence={i.intelligence}
                      personId={person.id}
                      existingSkills={(person.skills ?? []).map((s: any) => ({ skillId: s.skill.id, isPrimary: s.isPrimary }))}
                      onSkillAdded={load}
                    />
                  )}
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
              </div>
              )}
            </li>
            );
          })}
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
              {QC_SECTION_FIELDS.map((s) => (
                <label key={s.field} className="block text-sm">
                  <span className="mb-0.5 block text-xs font-medium uppercase text-slate-500">{s.label}</span>
                  <span className="mb-1 block text-xs text-slate-400">{s.hint}</span>
                  <textarea
                    className="w-full rounded border px-3 py-2 text-sm"
                    placeholder="Leave blank if it didn't come up"
                    rows={3}
                    value={qualificationSections[s.field] ?? ""}
                    onChange={(e) => setQualificationSections((prev) => ({ ...prev, [s.field]: e.target.value }))}
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
            <button
              type="submit"
              disabled={loggingInteraction}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loggingInteraction ? "Logging..." : "Log"}
            </button>
          </div>
          {logInteractionError && <p className="text-sm text-red-600">{logInteractionError}</p>}
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

// Same click-to-edit convention as InlineField, but for a Company link:
// display mode keeps the existing hyperlink to the company's own page,
// with a separate small "Edit" affordance that swaps in a CompanyPicker
// (searchable, with create-new-on-the-fly) rather than the link itself
// entering edit mode — clicking the company name should still navigate.
function CompanyLinkField({
  company,
  onSave,
}: {
  company: CompanyOption | null;
  onSave: (companyId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyOption | null>(company);

  useEffect(() => {
    if (!editing) setDraft(company);
  }, [company, editing]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <div className="flex-1">
          <CompanyPicker
            value={draft}
            onChange={(c) => {
              setDraft(c);
              // CompanyPicker also fires onChange(null) the moment someone
              // starts typing over an existing selection (it's clearing the
              // selection to let them search again) — that's not the same
              // as choosing to remove the company, so only an actual pick
              // or create commits and closes; clearing needs the explicit
              // button below.
              if (c) {
                onSave(c.id);
                setEditing(false);
              }
            }}
            placeholder="Search or add a new company"
          />
        </div>
        {company && (
          <button
            type="button"
            onClick={() => {
              onSave(null);
              setEditing(false);
            }}
            className="shrink-0 px-1 text-xs text-slate-400 hover:text-red-600"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 px-1 text-xs text-slate-400 hover:text-slate-600"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="group/field flex items-center gap-1">
      {company ? (
        <Link to={`/companies/${company.id}`} className={`rounded px-2 py-1 hover:bg-slate-100 ${COMPANY_LINK_CLASS}`}>
          {company.name}
        </Link>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="rounded px-2 py-1 text-left text-slate-400 hover:bg-slate-100">
          Not set
        </button>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 px-1 text-xs text-slate-400 opacity-0 hover:text-blue-600 group-hover/field:opacity-100"
      >
        Edit
      </button>
    </div>
  );
}
