import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DuplicateWarningModal from "../components/DuplicateWarningModal";
import CvParsePanel from "../components/CvParsePanel";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";

interface Person {
  id: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  name: string;
  email?: string;
  currentTitle?: string;
  jobTitle?: string;
  archivedAt?: string | null;
  company?: { name: string } | null;
  currentEmployer?: { name: string } | null;
  interactions?: { occurredAt: string }[];
}

function employerOf(p: Person): string {
  return (p.personType === "CANDIDATE" ? p.currentEmployer?.name : p.company?.name) ?? "—";
}

function lastNoteOf(p: Person): string {
  const latest = p.interactions?.[0]?.occurredAt;
  return latest ? new Date(latest).toLocaleDateString() : "—";
}

export function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [personType, setPersonType] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [newType, setNewType] = useState<"CANDIDATE" | "CLIENT_CONTACT">("CANDIDATE");
  const [duplicateMatches, setDuplicateMatches] = useState<any[] | null>(null);
  const navigate = useNavigate();

  function load(query = q, type = personType, archived = showArchived) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("personType", type);
    if (archived) params.set("includeArchived", "true");
    api.get<Person[]>(`/api/people?${params.toString()}`).then(setPeople);
  }

  useEffect(() => load(), []);

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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="w-full max-w-sm rounded border px-3 py-2 text-sm"
          placeholder="Search people..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load(e.target.value, personType, showArchived);
          }}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={personType}
          onChange={(e) => {
            setPersonType(e.target.value);
            load(q, e.target.value, showArchived);
          }}
        >
          <option value="">All types</option>
          <option value="CANDIDATE">Candidates</option>
          <option value="CLIENT_CONTACT">Client contacts</option>
        </select>
        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              load(q, personType, e.target.checked);
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
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Employer</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Date of last note</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className={`border-t ${p.archivedAt ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <Link to={`/people/${p.id}`} className="text-blue-600">
                    {p.name}
                  </Link>
                  {p.archivedAt && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">Archived</span>
                  )}
                </td>
                <td className="px-3 py-2">{p.personType === "CANDIDATE" ? "Candidate" : "Client contact"}</td>
                <td className="px-3 py-2">{p.currentTitle ?? p.jobTitle ?? "—"}</td>
                <td className="px-3 py-2">{employerOf(p)}</td>
                <td className="px-3 py-2">{p.email ?? "—"}</td>
                <td className="px-3 py-2">{lastNoteOf(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_PERSON_FORM = {
  name: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  addressStreet: "",
  addressCity: "",
  addressPostcode: "",
  followUpAt: "",
  followUpNote: "",
};

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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_PERSON_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get(`/api/people/${id}`).then((p: any) => {
      setPerson(p);
      setForm({
        name: p.name ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        linkedinUrl: p.linkedinUrl ?? "",
        addressStreet: p.addressStreet ?? "",
        addressCity: p.addressCity ?? "",
        addressPostcode: p.addressPostcode ?? "",
        followUpAt: toDateInputValue(p.followUpAt),
        followUpNote: p.followUpNote ?? "",
      });
      // Default the quick-log company link to whichever company this person
      // is already associated with, but leave it changeable.
      setInteractionCompanyId((prev) => prev || p.companyId || p.currentEmployerId || "");
    });
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

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/people/${id}`, form);
      setEditing(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function onToggleArchive() {
    await api.post(`/api/people/${id}/${person.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  if (!person) return <p>Loading...</p>;

  const hasAddress = person.addressStreet || person.addressCity || person.addressPostcode;

  return (
    <div className="space-y-6">
      {person.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This person is archived. They're hidden from the default list but nothing has been deleted.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <p className="text-sm text-slate-500">
            {person.personType === "CANDIDATE" ? person.currentTitle : person.jobTitle}
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
            {person.archivedAt ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>

      <div className={person.personType === "CANDIDATE" ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : ""}>
      <div className="space-y-6">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <Field label="LinkedIn profile">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="https://www.linkedin.com/in/..."
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Follow-up reminder date">
              <input
                type="date"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.followUpAt}
                onChange={(e) => setForm({ ...form, followUpAt: e.target.value })}
              />
            </Field>
            <Field label="Follow-up note">
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.followUpNote}
                onChange={(e) => setForm({ ...form, followUpNote: e.target.value })}
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
            <DetailRow label="Email">
              {person.email ? (
                <a href={`mailto:${person.email}`} className="text-blue-600">
                  {person.email}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Phone">{person.phone || "—"}</DetailRow>
            <DetailRow label="LinkedIn">
              {person.linkedinUrl ? (
                <a href={person.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600">
                  {person.linkedinUrl}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow label="Address">
              {hasAddress
                ? [person.addressStreet, person.addressCity, person.addressPostcode].filter(Boolean).join(", ")
                : "—"}
            </DetailRow>
            <DetailRow label="Follow-up reminder">
              {person.followUpAt ? (
                <span className={isOverdue(person.followUpAt) ? "font-medium text-red-600" : ""}>
                  {new Date(person.followUpAt).toLocaleDateString()}
                  {person.followUpNote ? ` — ${person.followUpNote}` : ""}
                  {isOverdue(person.followUpAt) ? " (overdue)" : ""}
                </span>
              ) : (
                "—"
              )}
            </DetailRow>
          </dl>
        </section>
      )}

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
