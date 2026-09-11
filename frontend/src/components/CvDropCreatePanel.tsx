import { FormEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import DuplicateWarningModal from "./DuplicateWarningModal";

interface SkillRef {
  id: string;
  name: string;
}

interface ExtractedFields {
  firstName?: string;
  surname?: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  currentEmployerName?: string;
  skills: SkillRef[];
  suggestedSkills: SkillRef[];
}

const EMPTY_FORM = { firstName: "", surname: "", email: "", phone: "", currentTitle: "", currentEmployerName: "" };

// Drop a CV straight onto the dashboard to create a brand-new Candidate —
// parse, review/correct, duplicate-check, then create + attach the same CV
// as their first document. Nothing is saved until "Create candidate".
export default function CvDropCreatePanel() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [skillOptions, setSkillOptions] = useState<SkillRef[]>([]);
  const [suggestedSkillOptions, setSuggestedSkillOptions] = useState<SkillRef[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [duplicateMatches, setDuplicateMatches] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function reset() {
    setFile(null);
    setForm(EMPTY_FORM);
    setSkillOptions([]);
    setSuggestedSkillOptions([]);
    setSelectedSkillIds(new Set());
    setDuplicateMatches(null);
    setError(null);
  }

  async function handleFile(f: File) {
    setError(null);
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      setError("Only PDF and Word (.docx) CVs are supported.");
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", f);
      const { extracted } = await api.post<{ extracted: ExtractedFields }>("/api/cv/parse", formData);
      setForm({
        firstName: extracted.firstName ?? "",
        surname: extracted.surname ?? "",
        email: extracted.email ?? "",
        phone: extracted.phone ?? "",
        currentTitle: extracted.currentTitle ?? "",
        currentEmployerName: extracted.currentEmployerName ?? "",
      });
      setSkillOptions(extracted.skills);
      setSelectedSkillIds(new Set(extracted.skills.map((s) => s.id)));
      const confirmedIds = new Set(extracted.skills.map((s) => s.id));
      setSuggestedSkillOptions(extracted.suggestedSkills.filter((s) => !confirmedIds.has(s.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that CV");
      setFile(null);
    } finally {
      setParsing(false);
    }
  }

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function attachCv(personId: string) {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "CANDIDATE_CV");
    formData.append("personId", personId);
    await api.post("/api/documents", formData);
  }

  async function createAndAttach(linkedPersonId?: string) {
    setCreating(true);
    setError(null);
    try {
      const person = await api.post<{ id: string }>("/api/people", {
        personType: "CANDIDATE",
        firstName: form.firstName,
        surname: form.surname || undefined,
        workEmail: form.email || undefined,
        phone: form.phone || undefined,
        currentTitle: form.currentTitle || undefined,
        currentEmployerName: form.currentEmployerName || undefined,
        skillIds: Array.from(selectedSkillIds),
        linkedPersonId,
      });
      await attachCv(person.id);
      navigate(`/people/${person.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create candidate");
      setCreating(false);
    }
  }

  async function useExisting(personId: string) {
    setCreating(true);
    setError(null);
    try {
      await attachCv(personId);
      navigate(`/people/${personId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not attach CV to that record");
      setCreating(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { matches } = await api.post<{ matches: any[] }>("/api/people/check-duplicates", {
        firstName: form.firstName,
        surname: form.surname || undefined,
        workEmail: form.email || undefined,
        phone: form.phone || undefined,
      });
      if (matches.length) setDuplicateMatches(matches);
      else await createAndAttach();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check for duplicates");
    }
  }

  return (
    <section className="rounded border bg-white p-4">
      <h2 className="mb-1 font-medium">Add a candidate from their CV</h2>
      <p className="mb-3 text-sm text-slate-500">
        Drop a CV (PDF or Word) to auto-fill a new candidate record — review and correct before it's saved.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleFile(dropped);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed py-10 text-center text-sm transition-colors ${
            dragging ? "border-slate-900 bg-slate-50" : "border-slate-300 text-slate-500 hover:bg-slate-50"
          }`}
        >
          {parsing ? (
            <p>Parsing CV...</p>
          ) : (
            <>
              <p className="font-medium text-slate-700">Drop a CV here</p>
              <p className="mt-1 text-xs text-slate-400">or click to browse — PDF or .docx</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <p className="text-xs text-slate-500">
            From <span className="font-medium text-slate-700">{file.name}</span> — review before creating.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">First name *</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Surname</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.surname}
                onChange={(e) => setForm({ ...form, surname: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Work email</span>
              <input
                type="email"
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Phone</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Current title</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.currentTitle}
                onChange={(e) => setForm({ ...form, currentTitle: e.target.value })}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Current employer</span>
              <input
                className="w-full rounded border px-3 py-2 text-sm"
                value={form.currentEmployerName}
                onChange={(e) => setForm({ ...form, currentEmployerName: e.target.value })}
              />
            </label>
          </div>

          {skillOptions.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-slate-600">Skills</p>
              <div className="flex flex-wrap gap-2">
                {skillOptions.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.has(s.id)}
                      onChange={() => toggleSkill(s.id)}
                    />
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
                    <input
                      type="checkbox"
                      checked={selectedSkillIds.has(s.id)}
                      onChange={() => toggleSkill(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Discard
            </button>
            <button
              disabled={creating || !form.firstName.trim()}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create candidate"}
            </button>
          </div>
        </form>
      )}

      {duplicateMatches && (
        <DuplicateWarningModal
          candidate={{ firstName: form.firstName, surname: form.surname, workEmail: form.email, phone: form.phone }}
          matches={duplicateMatches}
          onUseExisting={(personId) => useExisting(personId)}
          onLinkNew={(personId) => createAndAttach(personId)}
          onCreateAnyway={() => createAndAttach()}
          onCancel={() => setDuplicateMatches(null)}
        />
      )}
    </section>
  );
}
