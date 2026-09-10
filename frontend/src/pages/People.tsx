import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

  function load(query = q, type = personType) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (type) params.set("personType", type);
    api.get<Person[]>(`/api/people?${params.toString()}`).then(setPeople);
  }

  useEffect(() => load(), []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/people", { name, personType: newType });
    setName("");
    setShowForm(false);
    load();
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

export function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState<any>(null);
  const [note, setNote] = useState("");
  const [interactionType, setInteractionType] = useState("PHONE_CALL");

  function load() {
    api.get(`/api/people/${id}`).then(setPerson);
  }

  useEffect(load, [id]);

  async function logInteraction(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/interactions", { personId: id, type: interactionType, notes: note });
    setNote("");
    load();
  }

  if (!person) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{person.name}</h1>
        <p className="text-sm text-slate-500">
          {person.personType === "CANDIDATE" ? person.currentTitle : person.jobTitle} ·{" "}
          {person.email}
        </p>
      </div>

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
