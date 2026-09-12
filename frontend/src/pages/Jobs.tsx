import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import DocumentPreviewPanel from "../components/DocumentPreviewPanel";
import SkillPicker from "../components/SkillPicker";
import RoleTypePicker from "../components/RoleTypePicker";
import TagPicker from "../components/TagPicker";
import CustomFieldsPanel from "../components/CustomFieldsPanel";
import JobCreateForm from "../components/JobCreateForm";
import CandidatePipelinePicker from "../components/CandidatePipelinePicker";
import ScheduledEventsPanel from "../components/ScheduledEventsPanel";
import RecordTypeDot from "../components/RecordTypeDot";
import { fullName } from "../lib/personName";
import { ordinal } from "../lib/ordinal";
import { daysSince, STALE_DAYS } from "../lib/staleness";
import { JOB_LINK_CLASS, RECORD_KIND_BORDER_CLASS, RECORD_KIND_TEXT_CLASS, personLinkClass } from "../lib/recordColors";

interface Job {
  id: string;
  title: string;
  stage: string;
  qualityRating: string;
  company: { id: string; name: string };
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  candidates: { stage: string }[];
}

// Candidate pipeline stages summarized directly on the Jobs list row, so
// sourcing progress is visible without opening the job — the specific
// subset the recruiter scans for at a glance, not every possible stage.
const JOBS_LIST_PIPELINE_STAGES = ["CV_SENT", "FIRST_INTERVIEW", "FURTHER_INTERVIEWS"];

// A/B/C only — the recruiter's own judgement of how likely this job is to
// close, never calculated. Required at creation so nothing goes unrated.
const QUALITY_RATINGS = ["A", "B", "C"];

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

// Action types for the Pipeline Activity filter — every stage a candidate
// can reach, plus a synthetic type for interview-scheduled entries (which
// aren't a stage change at all).
const ACTION_TYPE_LABELS: Record<string, string> = {
  ...PIPELINE_STAGE_LABELS,
  INTERVIEW_SCHEDULED: "Interview Scheduled",
};

const INTERVIEW_STAGES = new Set(["FIRST_INTERVIEW", "FURTHER_INTERVIEWS"]);

// Compact "10 Sep, 11:00" style — distinct from the app's usual DD/MM/YYYY,
// used specifically for describing an interview's own scheduled slot within
// the Pipeline Activity log.
function formatShortDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${time}`;
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  // Off by default so the day-to-day list only shows jobs that still need
  // attention — Placed/Rejected jobs are done and would just be clutter.
  const [includeClosed, setIncludeClosed] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<{ id: string; name: string }[]>([]);
  // Column-header sort — same clickable-header/arrow-indicator pattern the
  // People list already uses. Starts matching the server's own default
  // order (most recently touched first) so the initial view is unchanged.
  const [sortKey, setSortKey] = useState<"title" | "company" | "stage" | "qualityRating" | "createdAt" | "updatedAt">(
    "updatedAt"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function load(opts: {
    archived?: boolean;
    ratings?: Set<string>;
    query?: string;
    company?: string;
    stage?: string;
    closed?: boolean;
  } = {}) {
    const archived = opts.archived ?? showArchived;
    const ratings = opts.ratings ?? ratingFilter;
    const query = opts.query ?? q;
    const company = opts.company ?? companyId;
    const stage = opts.stage ?? stageFilter;
    const closed = opts.closed ?? includeClosed;

    const params = new URLSearchParams();
    if (archived) params.set("includeArchived", "true");
    for (const r of ratings) params.append("qualityRating", r);
    if (query) params.set("q", query);
    if (company) params.set("companyId", company);
    if (stage) params.set("stage", stage);
    if (closed) params.set("includeClosed", "true");
    const qs = params.toString();
    api.get<Job[]>(`/api/jobs${qs ? `?${qs}` : ""}`).then(setJobs);
  }

  useEffect(() => load(), []);
  useEffect(() => {
    api.get<{ id: string; name: string }[]>("/api/companies").then(setCompanyOptions);
  }, []);

  const displayedJobs = useMemo(() => {
    const arr = [...jobs];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "company":
          cmp = (a.company?.name ?? "").localeCompare(b.company?.name ?? "");
          break;
        case "stage":
          cmp = a.stage.localeCompare(b.stage);
          break;
        case "qualityRating":
          cmp = a.qualityRating.localeCompare(b.qualityRating);
          break;
        case "createdAt":
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "updatedAt":
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [jobs, sortKey, sortDir]);

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: typeof sortKey) {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-slate-400">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  function toggleRating(rating: string) {
    setRatingFilter((prev) => {
      const next = new Set(prev);
      if (next.has(rating)) next.delete(rating);
      else next.add(rating);
      load({ ratings: next });
      return next;
    });
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
        <JobCreateForm
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="w-full max-w-xs rounded border px-3 py-2 text-sm"
          placeholder="Search title or company..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            load({ query: e.target.value });
          }}
        />

        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(e) => {
              setIncludeClosed(e.target.checked);
              load({ closed: e.target.checked });
            }}
          />
          Show closed (Placed/Rejected) jobs
        </label>

        <label className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              load({ archived: e.target.checked });
            }}
          />
          Show archived
        </label>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500">Quality rating:</span>
          {QUALITY_RATINGS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => toggleRating(r)}
              className={`rounded-full border px-2.5 py-1 font-medium ${
                ratingFilter.has(r)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 hover:bg-slate-100"
              }`}
            >
              {r}
            </button>
          ))}
          {ratingFilter.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setRatingFilter(new Set());
                load({ ratings: new Set() });
              }}
              className="text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">
                <button type="button" onClick={() => toggleSort("title")} className="flex items-center gap-1 font-medium hover:underline">
                  Title{sortIndicator("title")}
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("company")}
                  className="mb-1 flex items-center gap-1 font-medium hover:underline"
                >
                  Company{sortIndicator("company")}
                </button>
                <select
                  className="w-full rounded border px-1 py-0.5 text-xs font-normal"
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    load({ company: e.target.value });
                  }}
                >
                  <option value="">All companies</option>
                  {companyOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("stage")}
                  className="mb-1 flex items-center gap-1 font-medium hover:underline"
                >
                  Stage{sortIndicator("stage")}
                </button>
                <select
                  className="w-full rounded border px-1 py-0.5 text-xs font-normal"
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value);
                    load({ stage: e.target.value });
                  }}
                >
                  <option value="">All stages</option>
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("qualityRating")}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  Rating{sortIndicator("qualityRating")}
                </button>
              </th>
              <th className="px-3 py-2">Pipeline</th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("createdAt")}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  Created{sortIndicator("createdAt")}
                </button>
              </th>
              <th className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleSort("updatedAt")}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  Last updated{sortIndicator("updatedAt")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedJobs.map((j) => {
              const daysSinceUpdate = daysSince(j.updatedAt);
              const isStale = daysSinceUpdate >= STALE_DAYS;
              return (
                <tr
                  key={j.id}
                  className={`border-t border-l-4 ${RECORD_KIND_BORDER_CLASS.JOB} ${j.archivedAt ? "opacity-50" : ""}`}
                >
                  <td className="px-3 py-2">
                    <Link to={`/jobs/${j.id}`} className={JOB_LINK_CLASS}>
                      {j.title}
                    </Link>
                    {j.archivedAt && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">Archived</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{j.company?.name}</td>
                  <td className="px-3 py-2">{j.stage.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs font-medium">{j.qualityRating}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      {JOBS_LIST_PIPELINE_STAGES.map((stage) => {
                        const count = j.candidates.filter((c) => c.stage === stage).length;
                        return (
                          <span key={stage} title={PIPELINE_STAGE_LABELS[stage]} className="whitespace-nowrap">
                            {PIPELINE_STAGE_LABELS[stage]}{" "}
                            <span className={`font-semibold ${count > 0 ? "text-slate-900" : "text-slate-400"}`}>
                              {count}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600">{daysSince(j.createdAt)} days</td>
                  <td className={`px-3 py-2 whitespace-nowrap ${isStale ? "font-semibold text-red-600" : "text-slate-600"}`}>
                    {daysSinceUpdate} days
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const [job, setJob] = useState<any>(null);
  const [showPlacementForm, setShowPlacementForm] = useState(false);
  const [placementCandidateId, setPlacementCandidateId] = useState("");
  const [feeType, setFeeType] = useState("PERM_PERCENTAGE");
  const [feeValue, setFeeValue] = useState("");
  const [placementStartDate, setPlacementStartDate] = useState("");
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [suggestedCandidates, setSuggestedCandidates] = useState<any[]>([]);
  const [pipelineView, setPipelineView] = useState<"board" | "activity">("board");

  function load() {
    api.get(`/api/jobs/${id}`).then(setJob);
    api.get<any[]>(`/api/jobs/${id}/suggested-candidates`).then(setSuggestedCandidates);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function changeStage(stage: string) {
    await api.post(`/api/jobs/${id}/stage`, { stage });
    load();
  }

  async function changeQualityRating(qualityRating: string) {
    await api.patch(`/api/jobs/${id}`, { qualityRating });
    load();
  }

  async function addCandidate(candidateId: string) {
    await api.post("/api/pipeline", { jobId: id, candidateId });
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

  // Combined, chronological log of every candidate's stage changes and
  // scheduled interviews across this job's whole pipeline — pulled straight
  // from the per-candidate data already loaded with the job, not a separate
  // fetch. Sorted by when each thing actually happened/was logged
  // (createdAt), not — for interviews — the future date they're scheduled
  // for (that's what the dashboard's "Upcoming interviews" feed is for).
  const pipelineActivity = useMemo(() => {
    const entries: { id: string; at: string; candidate: any; actionType: string; description: string }[] = [];
    for (const jc of job?.candidates ?? []) {
      for (const sc of jc.stageChanges ?? []) {
        entries.push({
          id: `sc-${sc.id}`,
          at: sc.createdAt,
          candidate: jc.candidate,
          actionType: sc.toStage,
          description: sc.fromStage
            ? `Moved to ${PIPELINE_STAGE_LABELS[sc.toStage] ?? sc.toStage}`
            : `Added to pipeline — ${PIPELINE_STAGE_LABELS[sc.toStage] ?? sc.toStage}`,
        });
      }
      const sortedInterviews = [...(jc.scheduledEvents ?? [])].sort(
        (a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
      sortedInterviews.forEach((iv: any, idx: number) => {
        entries.push({
          id: `iv-${iv.id}`,
          at: iv.createdAt,
          candidate: jc.candidate,
          actionType: "INTERVIEW_SCHEDULED",
          description: `Interview scheduled — ${ordinal(idx + 1)} Interview, ${formatShortDateTime(iv.scheduledAt)}`,
        });
      });
    }
    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [job]);

  // Distinct candidates with any activity, for the Candidate filter dropdown.
  const activityCandidates = useMemo(() => {
    const byId = new Map<string, any>();
    for (const entry of pipelineActivity) byId.set(entry.candidate.id, entry.candidate);
    return [...byId.values()].sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [pipelineActivity]);

  // Empty selection = no filter applied (show everything) for both — easy
  // to combine, and clearing just means resetting these two back to empty.
  const [activityCandidateFilter, setActivityCandidateFilter] = useState("");
  const [activityTypeFilter, setActivityTypeFilter] = useState<Set<string>>(new Set());

  const filteredActivity = useMemo(() => {
    return pipelineActivity.filter((entry) => {
      if (activityCandidateFilter && entry.candidate.id !== activityCandidateFilter) return false;
      if (activityTypeFilter.size > 0 && !activityTypeFilter.has(entry.actionType)) return false;
      return true;
    });
  }, [pipelineActivity, activityCandidateFilter, activityTypeFilter]);

  function toggleActivityType(type: string) {
    setActivityTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const activityFiltersActive = activityCandidateFilter !== "" || activityTypeFilter.size > 0;

  function clearActivityFilters() {
    setActivityCandidateFilter("");
    setActivityTypeFilter(new Set());
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
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <RecordTypeDot kind="JOB" className="h-2.5 w-2.5" />
            {job.title}
          </h1>
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
          <div className="flex items-center gap-4">
            <h2 className="font-medium">Candidate pipeline</h2>
            <nav className="flex gap-1 rounded border bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPipelineView("board")}
                className={`rounded px-2 py-1 font-medium ${
                  pipelineView === "board" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Kanban board
              </button>
              <button
                type="button"
                onClick={() => setPipelineView("activity")}
                className={`rounded px-2 py-1 font-medium ${
                  pipelineView === "activity" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Pipeline Activity
              </button>
            </nav>
          </div>
          {pipelineView === "board" && (
            <CandidatePipelinePicker
              excludeIds={(job.candidates ?? []).map((jc: any) => jc.candidateId)}
              onAdd={addCandidate}
            />
          )}
        </div>
        {pipelineView === "board" && (
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
                        <ScheduledEventsPanel
                          events={jc.scheduledEvents ?? []}
                          parentField="jobCandidateId"
                          parentId={jc.id}
                          noun="interview"
                          onChange={load}
                        />
                      )}
                    </div>
                  ))}
                  {!inStage.length && <p className="px-1 py-2 text-center text-xs text-slate-400">—</p>}
                </div>
              </div>
            );
          })}
        </div>
        )}

        {pipelineView === "activity" && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <select
                className="rounded border px-2 py-1.5"
                value={activityCandidateFilter}
                onChange={(e) => setActivityCandidateFilter(e.target.value)}
              >
                <option value="">All candidates</option>
                {activityCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fullName(c)}
                  </option>
                ))}
              </select>
              {Object.entries(ACTION_TYPE_LABELS).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleActivityType(type)}
                  className={`rounded-full border px-2 py-1 ${
                    activityTypeFilter.has(type)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
              {activityFiltersActive && (
                <button type="button" onClick={clearActivityFilters} className="text-blue-600 hover:underline">
                  Clear filters
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-3 py-2">Date/time</th>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">What happened</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((entry) => (
                    <tr key={entry.id} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                        {new Date(entry.at).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Link to={`/people/${entry.candidate.id}`} className={personLinkClass(entry.candidate)}>
                          {fullName(entry.candidate)}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{entry.description}</td>
                    </tr>
                  ))}
                  {!filteredActivity.length && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                        {pipelineActivity.length ? "No activity matches these filters" : "No pipeline activity yet"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
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

      <section>
        <h2 className="mb-2 font-medium">Quality Rating</h2>
        <p className="mb-2 text-xs text-slate-500">
          Your own judgement of how likely this job is to close, and the quality of information you have on it —
          never calculated automatically.
        </p>
        <select
          className="rounded border px-2 py-2 text-sm"
          value={job.qualityRating}
          onChange={(e) => changeQualityRating(e.target.value)}
        >
          {QUALITY_RATINGS.map((r) => (
            <option key={r} value={r}>
              {r}
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
            {job.company?.terms?.feeStructurePercentage != null && (
              <p className="text-xs text-slate-400">
                Defaulted from {job.company.name}'s Fee Structure ({job.company.terms.feeStructurePercentage}%) — edit if
                different for this placement.
              </p>
            )}
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
            onClick={() => {
              setShowPlacementForm(true);
              // Default Fee % from the company's Terms Fee Structure — still
              // editable below for a one-off exception on this placement.
              const companyFeePct = job.company?.terms?.feeStructurePercentage;
              if (companyFeePct != null && !feeValue) setFeeValue(String(companyFeePct));
            }}
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

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <DocumentPreviewPanel
          label="Job Spec Document"
          documentType="JOB_SPEC"
          documents={job.documents ?? []}
          jobId={job.id}
          onChange={load}
        />
        <JobSpecTextPanel job={job} onChange={load} />
      </div>
      </div>
    </div>
  );
}

// Free-text alternative/complement to the uploaded Job Spec document — no
// version history, just a single field overwritten on save.
function JobSpecTextPanel({ job, onChange }: { job: any; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(job.jobSpecText ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(job.jobSpecText ?? "");
  }, [job.jobSpecText]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/api/jobs/${job.id}`, { jobSpecText: text });
      onChange();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Job Spec Notes/Text</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
          >
            {job.jobSpecText ? "Edit" : "Add notes"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            className="h-48 w-full rounded border p-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste or type the job spec here..."
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setText(job.jobSpecText ?? "");
                setEditing(false);
              }}
              disabled={saving}
              className="rounded border px-3 py-1.5 text-xs hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : job.jobSpecText ? (
        <p className="whitespace-pre-wrap text-sm">{job.jobSpecText}</p>
      ) : (
        <p className="rounded border border-dashed p-6 text-center text-sm text-slate-400">
          No job spec text added yet — click "Add notes" to paste or type it in.
        </p>
      )}
    </section>
  );
}
