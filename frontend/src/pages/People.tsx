import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

interface Person {
  id: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  name: string;
  email?: string;
  currentTitle?: string;
  jobTitle?: string;
}

export function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [q, setQ] = useState("");
  const [personType, setPersonType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [newType, setNewType] = useState<"CANDIDATE" | "CLIENT_CONTACT">("CANDIDATE");
  const navigate = useNavigate();

  function load(query = q, type = personType) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("personType", type);
    api.get<Person[]>(`/api/people?${params.toString()}`).then(setPeople);
  }

  useEffect(() => load(), []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const person = await api.post<Person>("/api/people", { name, personType: newType });
    setName("");
    setShowForm(false);
    // Straight to the detail page so email/phone/address/LinkedIn can be
    // filled in immediately, rather than making the quick-add form longer.
    navigate(`/people/${person.id}`);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">People</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          {showForm ? "Cancel" : "New person"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 flex gap-2 rounded border bg-white p-3">
          <select className="rounded border px-2 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.target.value as any)}>
            <option value="CANDIDATE">Candidate</option>
            <option value="CLIENT_CONTACT">Client contact</option>
          </select>
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      <div className="mb-4 flex gap-2">
        <input
          className="w-full max-w-sm rounded border px-3 py-2 text-sm"
          placeholder="Search people..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load(e.target.value, personType);
          }}
        />
        <select
          className="rounded border px-2 py-2 text-sm"
          value={personType}
          onChange={(e) => {
            setPersonType(e.target.value);
            load(q, e.target.value);
          }}
        >
          <option value="">All types</option>
          <option value="CANDIDATE">Candidates</option>
          <option value="CLIENT_CONTACT">Client contacts</option>
        </select>
      </div>

      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/people/${p.id}`} className="text-blue-600">
                    {p.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{p.personType === "CANDIDATE" ? "Candidate" : "Client contact"}</td>
                <td className="px-3 py-2">{p.currentTitle ?? p.jobTitle ?? "—"}</td>
                <td className="px-3 py-2">{p.email ?? "—"}</td>
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
};

export function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<any>(null);
  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState("PHONE_CALL");
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
      });
    });
  }

  useEffect(load, [id]);

  async function logInteraction(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/interactions", { personId: id, type: interactionType, notes: note });
    setNote("");
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

  if (!person) return <p>Loading...</p>;

  const hasAddress = person.addressStreet || person.addressCity || person.addressPostcode;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{person.name}</h1>
          <p className="text-sm text-slate-500">
            {person.personType === "CANDIDATE" ? person.currentTitle : person.jobTitle}
          </p>
        </div>
        <button
          onClick={() => setEditing((e) => !e)}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          {editing ? "Cancel" : "Edit details"}
        </button>
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
        <form onSubmit={logInteraction} className="flex gap-2 rounded border bg-white p-3">
          <select
            className="rounded border px-2 py-2 text-sm"
            value={interactionType}
            onChange={(e) => setInteractionType(e.target.value)}
          >
            {["PHONE_CALL", "VIDEO_MEETING", "FACE_TO_FACE", "QUALIFICATION_CALL", "LINKEDIN_MESSAGE", "EMAIL", "TEXT"].map(
              (t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              )
            )}
          </select>
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Notes"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Log</button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Interaction history</h2>
        <ul className="space-y-1 text-sm">
          {person.interactions?.map((i: any) => (
            <li key={i.id} className="rounded border bg-white p-2">
              <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
              {i.type.replaceAll("_", " ")} — {i.notes}
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
