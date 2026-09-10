import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";

interface Job {
  id: string;
  title: string;
  stage: string;
  company: { name: string };
}

interface Company {
  id: string;
  name: string;
}

const STAGES = [
  "POTENTIAL_LEAD",
  "QUALIFIED",
  "SPEC_TAKEN",
  "CV_SOURCING",
  "CVS_SENT",
  "INTERVIEWING",
  "OFFERED",
  "PLACED",
  "REJECTED",
];

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [companyId, setCompanyId] = useState("");

  function load() {
    api.get<Job[]>("/api/jobs").then(setJobs);
  }

  useEffect(() => {
    load();
    api.get<Company[]>("/api/companies").then(setCompanies);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/jobs", { title, companyId });
    setTitle("");
    setShowForm(false);
    load();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          {showForm ? "Cancel" : "New job"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={onCreate} className="mb-4 flex gap-2 rounded border bg-white p-3">
          <select className="rounded border px-2 py-2 text-sm" value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
            <option value="">Select company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded border px-3 py-2"
            placeholder="Job title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Create</button>
        </form>
      )}

      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Stage</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t">
                <td className="px-3 py-2">
                  <Link to={`/jobs/${j.id}`} className="text-blue-600">
                    {j.title}
                  </Link>
                </td>
                <td className="px-3 py-2">{j.company?.name}</td>
                <td className="px-3 py-2">{j.stage.replaceAll("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidateId, setCandidateId] = useState("");

  function load() {
    api.get(`/api/jobs/${id}`).then(setJob);
  }

  useEffect(() => {
    load();
    api.get("/api/people?personType=CANDIDATE").then(setCandidates);
  }, [id]);

  async function changeStage(stage: string) {
    await api.post(`/api/jobs/${id}/stage`, { stage });
    load();
  }

  async function addCandidate(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/pipeline", { jobId: id, candidateId });
    setCandidateId("");
    load();
  }

  if (!job) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{job.title}</h1>
        <p className="text-sm text-slate-500">
          {job.company?.name} · {job.location} · {job.workPreference}
        </p>
      </div>

      <section>
        <h2 className="mb-2 font-medium">Stage</h2>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={job.stage}
          onChange={(e) => changeStage(e.target.value)}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Candidates in pipeline</h2>
        <form onSubmit={addCandidate} className="mb-2 flex gap-2 rounded border bg-white p-3">
          <select className="flex-1 rounded border px-2 py-2 text-sm" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} required>
            <option value="">Add candidate...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Add to pipeline</button>
        </form>
        <ul className="space-y-1 text-sm">
          {job.candidates?.map((jc: any) => (
            <li key={jc.id} className="rounded border bg-white p-2">
              <Link to={`/people/${jc.candidate.id}`} className="text-blue-600">
                {jc.candidate.name}
              </Link>{" "}
              — {jc.stage.replaceAll("_", " ")}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Stage history</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          {job.stageChanges?.map((sc: any) => (
            <li key={sc.id}>
              {new Date(sc.createdAt).toLocaleString()} — {sc.fromStage ?? "(new)"} → {sc.toStage}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
