import { useState } from "react";
import { api } from "../api/client";

interface SkillRef {
  id: string;
  name: string;
}

interface ExtractedFields {
  name?: string;
  email?: string;
  phone?: string;
  currentTitle?: string;
  currentEmployerName?: string;
  skills: SkillRef[];
}

export default function CvParsePanel({
  personId,
  existingSkills,
  onSaved,
}: {
  personId: string;
  existingSkills: SkillRef[];
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedFields | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", currentTitle: "", currentEmployerName: "" });
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [allSkillOptions, setAllSkillOptions] = useState<SkillRef[]>([]);

  async function onFileSelected(file: File) {
    setError(null);
    setBusy(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { extracted: fields } = await api.post<{ extracted: ExtractedFields }>("/api/cv/parse", formData);
      setExtracted(fields);
      setForm({
        name: fields.name ?? "",
        email: fields.email ?? "",
        phone: fields.phone ?? "",
        currentTitle: fields.currentTitle ?? "",
        currentEmployerName: fields.currentEmployerName ?? "",
      });
      // Pre-check existing skills plus anything newly matched in the CV —
      // reviewing means correcting this set, not starting from a blank one.
      const union = new Map<string, SkillRef>();
      for (const s of [...existingSkills, ...fields.skills]) union.set(s.id, s);
      setAllSkillOptions(Array.from(union.values()));
      setSelectedSkillIds(new Set(union.keys()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not parse that CV");
    } finally {
      setBusy(false);
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

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/api/people/${personId}`, {
        name: form.name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        currentTitle: form.currentTitle || undefined,
        currentEmployerName: form.currentEmployerName || undefined,
        skillIds: Array.from(selectedSkillIds),
      });
      setExtracted(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded border bg-white p-4">
      <h2 className="mb-2 font-medium">Parse CV</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {!extracted ? (
        <div>
          <p className="mb-2 text-sm text-slate-500">
            Upload a PDF or .docx CV to auto-fill candidate fields below for you to review — nothing is saved until
            you confirm.
          </p>
          <input
            type="file"
            accept=".pdf,.docx"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && onFileSelected(e.target.files[0])}
            className="text-sm"
          />
          {busy && <p className="mt-2 text-sm text-slate-500">Parsing...</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Extracted from the CV — review and correct anything before saving to this candidate's record.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReviewField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <ReviewField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <ReviewField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <ReviewField
              label="Current title"
              value={form.currentTitle}
              onChange={(v) => setForm({ ...form, currentTitle: v })}
            />
            <ReviewField
              label="Current employer"
              value={form.currentEmployerName}
              onChange={(v) => setForm({ ...form, currentEmployerName: v })}
            />
          </div>

          {allSkillOptions.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-slate-600">Skills</p>
              <div className="flex flex-wrap gap-2">
                {allSkillOptions.map((s) => (
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

          <div className="flex gap-2">
            <button
              onClick={() => setExtracted(null)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Discard
            </button>
            <button
              disabled={busy}
              onClick={onSave}
              className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save to candidate record"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        className="w-full rounded border px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
