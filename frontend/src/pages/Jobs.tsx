import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";
import SkillPicker from "../components/SkillPicker";
import RoleTypePicker from "../components/RoleTypePicker";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import JobCreateForm from "../components/JobCreateForm";
import { fullName } from "../lib/personName";
import { RECORD_KIND_BORDER_CLASS, RECORD_KIND_TEXT_CLASS, personLinkClass } from "../lib/recordColors";

interface Job {
  id: string;
  title: string;
  stage: string;
  company: { name: string };
  archivedAt?: string | null;
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

const FEE_TYPE_OPTIONS = [
  { value: "PERM_PERCENTAGE", label: "Permanent (% of salary)" },
  { value: "CONTRACT_MARGIN", label: "Contract (margin)" },
  { value: "DAY_RATE_UPLIFT", label: "Day rate uplift" },
];

// Candidate-level pipeline stage (JobCandidate.stage) — distinct from the
// Job's own overall recruitment stage (STAGES above). Order matches the
// natural funnel, Rejected last since it's a terminal branch off any point.
const PIPELINE_STAGE_LABELS: Record<string, string> = {
  SHORTLISTED: "Shortlisted",
  CV_SENT: "CV Sent",
  FIRST_INTERVIEW: "1st Interview",
  FURTHER_INTERVIEWS: "Further Interviews",
  OFFERED: "Offered",
  PLACED: "Placed",
  REJECTED: "Rejected",
};
const PIPELINE_STAGES = Object.keys(PIPELINE_STAGE_LABELS);

const INTERVIEW_STAGES = new Set(["FIRST_INTERVIEW", "FURTHER_INTERVIEWS"]);

const INTERVIEW_FORMAT_LABELS: Record<string, string> = {
  PHONE: "Phone",
  VIDEO: "Video/Teams",
  FACE_TO_FACE: "Face to Face",
};

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  function load(archived = showArchived) {
    api.get<Job[]>(`/api/jobs${archived ? "?includeArchived=true" : ""}`).then(setJobs);
  }

  useEffect(() => load(), []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <button onClick={() => setShowForm((s) => !s)} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
          {showForm ? "Cancel" : "New job"}
        </button>
      </div>

      {showForm && (
        <JobCreateForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <label className="mb-4 flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => {
            setShowArchived(e.target.checked);
            load(e.target.checked);
          }}
        />
        Show archived
      </label>

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
              <tr key={j.id} className={`border-t ${j.archivedAt ? "opacity-50" : ""}`}>
                <td className="px-3 py-2">
                  <Link to={`/jobs/${j.id}`} className="text-blue-600">
                    {j.title}
                  </Link>
                  {j.archivedAt && (
                    <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">Archived</span>
                  )}
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
  const [showPlacementForm, setShowPlacementForm] = useState(false);
  const [placementCandidateId, setPlacementCandidateId] = useState("");
  const [feeType, setFeeType] = useState("PERM_PERCENTAGE");
  const [feeValue, setFeeValue] = useState("");
  const [placementStartDate, setPlacementStartDate] = useState("");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [suggestedCandidates, setSuggestedCandidates] = useState<any[]>([]);
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewTime, setInterviewTime] = useState("");
  const [interviewFormat, setInterviewFormat] = useState("VIDEO");
  const [interviewNotes, setInterviewNotes] = useState("");

  function load() {
    api.get(`/api/jobs/${id}`).then(setJob);
    api.get<any[]>(`/api/jobs/${id}/suggested-candidates`).then(setSuggestedCandidates);
  }

  useEffect(() => {
    load();
    api.get<any[]>("/api/people?personType=CANDIDATE").then(setCandidates);
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

  async function addSuggestedCandidate(suggestedCandidateId: string) {
    await api.post("/api/pipeline", { jobId: id, candidateId: suggestedCandidateId });
    load();
  }

  async function changeCandidateStage(jobCandidateId: string, stage: string) {
    await api.post(`/api/pipeline/${jobCandidateId}/stage`, { stage });
    load();
  }

  function resetInterviewForm() {
    setSchedulingFor(null);
    setInterviewDate("");
    setInterviewTime("");
    setInterviewFormat("VIDEO");
    setInterviewNotes("");
  }

  async function scheduleInterview(e: FormEvent, jobCandidateId: string) {
    e.preventDefault();
    await api.post("/api/interviews", {
      jobCandidateId,
      scheduledAt: new Date(`${interviewDate}T${interviewTime || "09:00"}`).toISOString(),
      format: interviewFormat,
      notes: interviewNotes || undefined,
    });
    resetInterviewForm();
    load();
  }

  async function deleteInterview(interviewId: string) {
    await api.delete(`/api/interviews/${interviewId}`);
    load();
  }

  async function onToggleArchive() {
    await api.post(`/api/jobs/${id}/${job.archivedAt ? "unarchive" : "archive"}`);
    load();
  }

  async function createPlacement(e: FormEvent) {
    e.preventDefault();
    setPlacementError(null);
    try {
      await api.post("/api/placements", {
        jobId: id,
        candidateId: placementCandidateId,
        feeType,
        feeValue: Number(feeValue),
        startDate: placementStartDate,
      });
      setShowPlacementForm(false);
      setPlacementCandidateId("");
      setFeeValue("");
      setPlacementStartDate("");
      load();
    } catch (err) {
      setPlacementError(err instanceof Error ? err.message : "Could not record placement");
    }
  }

  if (!job) return <p>Loading...</p>;

  // "Winner" pool: whoever's reached Offered (or already flagged Placed) in
  // this job's pipeline — that's who a placement can sensibly be recorded for.
  const placementEligibleCandidates = (job.candidates ?? []).filter((jc: any) =>
    ["OFFERED", "PLACED"].includes(jc.stage)
  );

  return (
    <div className="space-y-6">
      {job.archivedAt && (
        <div className="rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          This job is archived. It's hidden from the default list but nothing has been deleted.
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">{job.title}</h1>
          <p className="text-xs text-slate-500">
            {job.company?.name} · {job.location} · {job.workPreference}
          </p>
        </div>
        <button onClick={onToggleArchive} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          {job.archivedAt ? "Unarchive" : "Archive"}
        </button>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Candidate pipeline</h2>
          <form onSubmit={addCandidate} className="flex gap-2">
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              required
            >
              <option value="">Add candidate...</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </select>
            <button className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">Add to pipeline</button>
          </form>
        </div>
        <div className="flex gap-3 overflow-x-auto">
          {PIPELINE_STAGES.map((stage) => {
            const inStage = (job.candidates ?? []).filter((jc: any) => jc.stage === stage);
            return (
              <div key={stage} className="w-56 shrink-0 rounded border bg-white">
                <div className="border-b bg-slate-100 px-3 py-2 text-sm font-medium">
                  {PIPELINE_STAGE_LABELS[stage]} ({inStage.length})
                </div>
                <div className="space-y-2 p-2">
                  {inStage.map((jc: any) => (
                    <div key={jc.id} className={`rounded border border-l-4 p-2 text-xs ${RECORD_KIND_BORDER_CLASS.CANDIDATE}`}>
                      <Link to={`/people/${jc.candidate.id}`} className={`font-medium ${RECORD_KIND_TEXT_CLASS.CANDIDATE}`}>
                        {fullName(jc.candidate)}
                      </Link>
                      <select
                        className="mt-1 w-full rounded border px-1 py-1 text-xs"
                        value={jc.stage}
                        onChange={(e) => changeCandidateStage(jc.id, e.target.value)}
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {PIPELINE_STAGE_LABELS[s]}
                          </option>
                        ))}
                      </select>

                      {INTERVIEW_STAGES.has(jc.stage) && (
                        <div className="mt-2 border-t pt-2">
                          {jc.interviews?.map((iv: any, idx: number) => (
                            <div key={iv.id} className="mb-1 flex items-start justify-between gap-1">
                              <p className="text-slate-600">
                                Interview {idx + 1}: {new Date(iv.scheduledAt).toLocaleDateString()}{" "}
                                {new Date(iv.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                                {INTERVIEW_FORMAT_LABELS[iv.format]}
                                {iv.notes && <span className="block text-slate-400">{iv.notes}</span>}
                              </p>
                              <button
                                type="button"
                                onClick={() => deleteInterview(iv.id)}
                                className="shrink-0 text-slate-400 hover:text-red-600"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          {schedulingFor === jc.id ? (
                            <form onSubmit={(e) => scheduleInterview(e, jc.id)} className="mt-1 space-y-1">
                              <div className="flex gap-1">
                                <input
                                  type="date"
                                  className="w-full rounded border px-1 py-1 text-xs"
                                  value={interviewDate}
                                  onChange={(e) => setInterviewDate(e.target.value)}
                                  required
                                />
                                <input
                                  type="time"
                                  className="w-full rounded border px-1 py-1 text-xs"
                                  value={interviewTime}
                                  onChange={(e) => setInterviewTime(e.target.value)}
                                  required
                                />
                              </div>
                              <select
                                className="w-full rounded border px-1 py-1 text-xs"
                                value={interviewFormat}
                                onChange={(e) => setInterviewFormat(e.target.value)}
                              >
                                {Object.entries(INTERVIEW_FORMAT_LABELS).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="w-full rounded border px-1 py-1 text-xs"
                                placeholder="Notes (interviewer, location/link)"
                                value={interviewNotes}
                                onChange={(e) => setInterviewNotes(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <button type="submit" className="flex-1 rounded bg-slate-900 px-2 py-1 text-xs text-white">
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={resetInterviewForm}
                                  className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSchedulingFor(jc.id)}
                              className="text-blue-600 hover:underline"
                            >
                              + Schedule interview
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {!inStage.length && <p className="px-1 py-2 text-center text-xs text-slate-400">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
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

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-medium">Role Type</h2>
        <p className="mb-2 text-xs text-slate-500">What this role requires — select one or more.</p>
        <RoleTypePicker
          selectedIds={(job.roleTypes ?? []).map((rt: any) => rt.id)}
          onSave={async (roleTypeIds) => {
            await api.patch(`/api/jobs/${job.id}`, { roleTypeIds });
            load();
          }}
        />
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-medium">Skills</h2>
        <p className="mb-2 text-xs text-slate-500">Tick Essential and/or Ideal for each skill this role needs.</p>
        <SkillPicker
          mode="job"
          jobId={job.id}
          essentialSkillIds={(job.essentialSkills ?? []).map((s: any) => s.id)}
          idealSkillIds={(job.idealSkills ?? []).map((s: any) => s.id)}
          onChange={load}
        />
      </section>

      {suggestedCandidates.length > 0 && (
        <section className="rounded border border-amber-200 bg-amber-50 p-3">
          <h2 className="mb-1 font-medium">Previously shortlisted — may fit</h2>
          <p className="mb-2 text-xs text-slate-500">
            Reached Shortlisted or beyond on a past job but weren't placed, and match this role's skills, seniority,
            or location. A suggestion to review — not added to this job's pipeline automatically.
          </p>
          <ul className="space-y-1 text-sm">
            {suggestedCandidates.map((s: any) => (
              <li
                key={s.candidate.id}
                className={`flex items-center justify-between rounded border border-l-4 bg-white p-2 ${RECORD_KIND_BORDER_CLASS.CANDIDATE}`}
              >
                <span>
                  <Link to={`/people/${s.candidate.id}`} className={RECORD_KIND_TEXT_CLASS.CANDIDATE}>
                    {fullName(s.candidate)}
                  </Link>
                  {s.candidate.seniority && <span className="text-slate-500"> — {s.candidate.seniority}</span>}
                  {s.candidate.location && <span className="text-slate-500"> · {s.candidate.location}</span>}
                  <p className="text-xs text-slate-400">
                    Previously shortlisted for {s.sourceJob.title} at {s.sourceJob.companyName}
                    {s.matchingSkills.length > 0 && ` · Matches: ${s.matchingSkills.map((sk: any) => sk.name).join(", ")}`}
                    {s.seniorityMatch && " · Seniority match"}
                    {s.locationMatch && " · Location match"}
                  </p>
                </span>
                <button
                  type="button"
                  onClick={() => addSuggestedCandidate(s.candidate.id)}
                  className="shrink-0 rounded border px-2 py-1 text-xs hover:bg-slate-100"
                >
                  Add to pipeline
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-medium">Placement</h2>
        {job.placement ? (
          <div className="text-sm">
            <p>
              <Link to={`/people/${job.placement.candidate.id}`} className={RECORD_KIND_TEXT_CLASS.CANDIDATE}>
                {fullName(job.placement.candidate)}
              </Link>{" "}
              placed — {FEE_TYPE_OPTIONS.find((f) => f.value === job.placement.feeType)?.label ?? job.placement.feeType},
              fee {job.placement.feeValue}
            </p>
            <p className="mt-1 text-slate-500">
              Started {new Date(job.placement.startDate).toLocaleDateString()} · Invoice:{" "}
              {job.placement.invoiceStatus.replaceAll("_", " ")}
            </p>
            <Link to="/placements" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
              View all placements →
            </Link>
          </div>
        ) : placementEligibleCandidates.length === 0 ? (
          <p className="text-sm text-slate-400">Available once a candidate reaches Offered.</p>
        ) : showPlacementForm ? (
          <form onSubmit={createPlacement} className="space-y-2 text-sm">
            {placementError && <p className="text-red-600">{placementError}</p>}
            <select
              className="w-full rounded border px-2 py-2"
              value={placementCandidateId}
              onChange={(e) => setPlacementCandidateId(e.target.value)}
              required
            >
              <option value="">Winning candidate...</option>
              {placementEligibleCandidates.map((jc: any) => (
                <option key={jc.candidate.id} value={jc.candidate.id}>
                  {fullName(jc.candidate)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded border px-2 py-2"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
              >
                {FEE_TYPE_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-32 rounded border px-2 py-2"
                placeholder="Fee value"
                value={feeValue}
                onChange={(e) => setFeeValue(e.target.value)}
                required
              />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Placement start date</span>
              <input
                type="date"
                className="rounded border px-2 py-2"
                value={placementStartDate}
                onChange={(e) => setPlacementStartDate(e.target.value)}
                required
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPlacementForm(false)}
                className="rounded border px-3 py-2 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button className="rounded bg-slate-900 px-3 py-2 text-white">Confirm placement</button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowPlacementForm(true)}
            className="rounded bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700"
          >
            Mark as Placed
          </button>
        )}
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-medium">Tags</h2>
        <TagPicker taggableType="JOB" taggableId={job.id} attachedLinks={job.tags ?? []} onChange={load} />
      </section>

      <section className="rounded border bg-white p-3">
        <h2 className="mb-2 font-medium">Custom fields</h2>
        <CustomFieldsPanel taggableType="JOB" taggableId={job.id} />
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

      <section>
        <h2 className="mb-2 font-medium">Interactions linked to this job</h2>
        <ul className="space-y-1 text-sm">
          {job.interactions?.map((i: any) => (
            <li key={i.id} className="rounded border bg-white p-2">
              <span className="text-slate-500">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
              {i.type.replaceAll("_", " ")} —{" "}
              <Link to={`/people/${i.person.id}`} className={personLinkClass(i.person)}>
                {fullName(i.person)}
              </Link>{" "}
              — <span className="whitespace-pre-wrap">{i.notes}</span>
            </li>
          ))}
          {!job.interactions?.length && <li className="text-slate-400">None yet</li>}
        </ul>
      </section>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <DocumentPreviewPanel
          label="Job Spec"
          documentType="JOB_SPEC"
          documents={job.documents ?? []}
          jobId={job.id}
          onChange={load}
        />
      </div>
      </div>
    </div>
  );
}
