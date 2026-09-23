import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import JobDuplicateWarningModal from "./JobDuplicateWarningModal";

// Shorter than the api client's generous 60s default — an extraction
// should never legitimately take this long, so a genuine hang surfaces as
// a clear error well inside the ~30s a person will actually wait before
// giving up and concluding "nothing happened", same reasoning as CV parsing.
const PARSE_TIMEOUT_MS = 25000;

interface SkillRef {
  id: string;
  name: string;
}

interface CompanyMatchSuggestion {
  id: string;
  name: string;
}

interface ExtractedJobFields {
  title?: string;
  companyName?: string;
  location?: string;
  level?: string;
  workPreference?: "REMOTE" | "HYBRID" | "ONSITE";
  salaryMin?: number;
  salaryMax?: number;
  rateMin?: number;
  rateMax?: number;
  jobSpecText: string;
  employerMatchSuggestion?: CompanyMatchSuggestion | null;
  skills: SkillRef[];
  suggestedSkills: SkillRef[];
}

const EMPTY_FORM = {
  title: "",
  companyName: "",
  location: "",
  level: "",
  workPreference: "",
  salaryMin: "",
  salaryMax: "",
  rateMin: "",
  rateMax: "",
  jobSpecText: "",
};

interface CreatedJob {
  id: string;
}

// Paste a LinkedIn (or similar) job posting to draft a new Job record —
// parse, review/correct, duplicate-check, then create. Nothing is saved
// until "Create job", same reviewable-draft pattern as CvDropCreatePanel:
// the AI drafts structured fields, but jobSpecText is always the raw
// pasted text verbatim (never AI-touched), and qualityRating is never
// pre-filled — it's the recruiter's own judgement call, same as the plain
// JobCreateForm this shares its save endpoints with.
export default function JobPostCreatePanel({ onCreated }: { onCreated: (job: CreatedJob) => void }) {
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [qualityRating, setQualityRating] = useState("");
  const [skillOptions, setSkillOptions] = useState<SkillRef[]>([]);
  const [suggestedSkillOptions, setSuggestedSkillOptions] = useState<SkillRef[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [employerMatchSuggestion, setEmployerMatchSuggestion] = useState<CompanyMatchSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [duplicateMatches, setDuplicateMatches] = useState<any[] | null>(null);

  useEffect(() => {
    if (!parsing) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [parsing]);

  function reset() {
    setPastedText("");
    setParsed(false);
    setForm(EMPTY_FORM);
    setQualityRating("");
    setSkillOptions([]);
    setSuggestedSkillOptions([]);
    setSelectedSkillIds(new Set());
    setEmployerMatchSuggestion(null);
    setError(null);
    setDuplicateMatches(null);
  }

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onParse(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setParsing(true);
    try {
      const { extracted } = await api.post<{ extracted: ExtractedJobFields }>(
        "/api/jobs/parse",
        { text: pastedText },
        PARSE_TIMEOUT_MS
      );
      setForm({
        title: extracted.title ?? "",
        companyName: extracted.companyName ?? "",
        location: extracted.location ?? "",
        level: extracted.level ?? "",
        workPreference: extracted.workPreference ?? "",
        salaryMin: extracted.salaryMin != null ? String(extracted.salaryMin) : "",
        salaryMax: extracted.salaryMax != null ? String(extracted.salaryMax) : "",
        rateMin: extracted.rateMin != null ? String(extracted.rateMin) : "",
        rateMax: extracted.rateMax != null ? String(extracted.rateMax) : "",
        jobSpecText: extracted.jobSpecText,
      });
      setSkillOptions(extracted.skills);
      setSelectedSkillIds(new Set(extracted.skills.map((s) => s.id)));
      const confirmedIds = new Set(extracted.skills.map((s) => s.id));
      setSuggestedSkillOptions(extracted.suggestedSkills.filter((s) => !confirmedIds.has(s.id)));
      setEmployerMatchSuggestion(extracted.employerMatchSuggestion ?? null);
      setParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that job post");
    } finally {
      setParsing(false);
    }
  }

  async function actuallyCreate() {
    setCreating(true);
    setError(null);
    try {
      const job = await api.post<CreatedJob>("/api/jobs", {
        title: form.title,
        companyName: form.companyName,
        qualityRating,
        location: form.location || undefined,
        level: form.level || undefined,
        workPreference: form.workPreference || undefined,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        rateMin: form.rateMin ? Number(form.rateMin) : undefined,
        rateMax: form.rateMax ? Number(form.rateMax) : undefined,
        jobSpecText: form.jobSpecText || undefined,
        essentialSkillIds: Array.from(selectedSkillIds),
      });
      onCreated(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create job");
    } finally {
      setCreating(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { matches } = await api.post<{ matches: any[] }>("/api/jobs/check-duplicates", {
        companyName: form.companyName,
        title: form.title,
      });
      if (matches.length) setDuplicateMatches(matches);
      else await actuallyCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check for existing jobs");
    }
  }

  return (
    <section className="mb-4 rounded border bg-white p-4">
      <h2 className="mb-1 font-medium">Paste a job post</h2>
      <p className="mb-3 text-sm text-slate-500">
        Paste the text of a LinkedIn (or similar) job posting to auto-draft a new Job record — review and correct
        before it's created.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!parsed ? (
        <form onSubmit={onParse} className="space-y-2">
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={8}
            placeholder="Paste the job post text here..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            required
          />
          {parsing ? (
            <div>
              <p className="text-sm text-slate-500">Parsing... ({elapsedSeconds}s)</p>
              {elapsedSeconds >= 10 && (
                <p className="mt-1 text-xs text-amber-600">
                  This is taking longer than usual — it will show an error within{" "}
                  {Math.max(0, Math.round(PARSE_TIMEOUT_MS / 1000) - elapsedSeconds)}s if it doesn't finish.
                </p>
              )}
            </div>
          ) : (
            <button
              disabled={!pastedText.trim()}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Parse
            </button>
          )}
        </form>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Job title *</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Company *</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.companyName}
                onChange={(e) => {
                  setForm({ ...form, companyName: e.target.value });
                  setEmployerMatchSuggestion(null);
                }}
                required
              />
              {employerMatchSuggestion && (
                <p className="mt-1 rounded border border-dashed border-amber-400 bg-amber-50 p-1.5 text-xs text-amber-700">
                  Did you mean the existing company "{employerMatchSuggestion.name}"?{" "}
                  <button
                    type="button"
                    className="font-medium text-blue-600 hover:underline"
                    onClick={() => {
                      setForm((f) => ({ ...f, companyName: employerMatchSuggestion.name }));
                      setEmployerMatchSuggestion(null);
                    }}
                  >
                    Use this
                  </button>{" "}
                  <button
                    type="button"
                    className="text-slate-500 hover:underline"
                    onClick={() => setEmployerMatchSuggestion(null)}
                  >
                    Keep as typed
                  </button>
                </p>
              )}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Location</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Level</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Work arrangement</span>
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.workPreference}
                onChange={(e) => setForm({ ...form, workPreference: e.target.value })}
              >
                <option value="">Not specified</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
                <option value="ONSITE">Onsite</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">
                Quality rating * <span className="text-xs text-slate-400">(your own judgement — not extracted)</span>
              </span>
              <select
                className="w-full rounded border px-3 py-2 text-sm"
                value={qualityRating}
                onChange={(e) => setQualityRating(e.target.value)}
                required
              >
                <option value="">Quality rating...</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Salary min</span>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.salaryMin}
                onChange={(e) => setForm({ ...form, salaryMin: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Salary max</span>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.salaryMax}
                onChange={(e) => setForm({ ...form, salaryMax: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Day rate min</span>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.rateMin}
                onChange={(e) => setForm({ ...form, rateMin: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Day rate max</span>
              <input
                type="number"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.rateMax}
                onChange={(e) => setForm({ ...form, rateMax: e.target.value })}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Job spec text</span>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={6}
              value={form.jobSpecText}
              onChange={(e) => setForm({ ...form, jobSpecText: e.target.value })}
            />
          </label>

          {skillOptions.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-slate-600">Essential skills</p>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
                    <input type="checkbox" checked={selectedSkillIds.has(s.id)} onChange={() => toggleSkill(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {suggestedSkillOptions.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-amber-700">
                Possibly also — a near-match, not certain, so left unchecked. Tick any that are correct.
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSkillOptions.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-1 rounded border border-dashed border-amber-400 bg-amber-50 px-2 py-1 text-sm"
                  >
                    <input type="checkbox" checked={selectedSkillIds.has(s.id)} onChange={() => toggleSkill(s.id)} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={reset} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
              Discard
            </button>
            <button
              disabled={creating || !form.title.trim() || !form.companyName.trim() || !qualityRating}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create job"}
            </button>
          </div>
        </form>
      )}

      {duplicateMatches && (
        <JobDuplicateWarningModal
          title={form.title}
          companyName={form.companyName}
          matches={duplicateMatches}
          onCreateAnyway={() => {
            setDuplicateMatches(null);
            actuallyCreate();
          }}
          onCancel={() => setDuplicateMatches(null)}
        />
      )}
    </section>
  );
}
