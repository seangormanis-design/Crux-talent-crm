import { useEffect, useState } from "react";
import { api } from "../api/client";

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

// Shown in place of the CV box's preview/history while a just-chosen file is
// being parsed and reviewed. One confirm both updates the candidate's fields
// and saves the file as the new CV version — a CV is never uploaded "blind"
// without the chance to catch what parsing found, and never parsed without
// the file itself being kept on file.
export default function CvReviewPanel({
  file,
  personId,
  existingDocId,
  existingSkills,
  onDone,
  onCancel,
}: {
  file: File;
  personId: string;
  existingDocId?: string;
  existingSkills: SkillRef[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [parsing, setParsing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [allSkillOptions, setAllSkillOptions] = useState<SkillRef[]>([]);
  const [suggestedSkillOptions, setSuggestedSkillOptions] = useState<SkillRef[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setParsing(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { extracted } = await api.post<{ extracted: ExtractedFields }>("/api/cv/parse", formData);
        if (cancelled) return;
        setForm({
          firstName: extracted.firstName ?? "",
          surname: extracted.surname ?? "",
          email: extracted.email ?? "",
          phone: extracted.phone ?? "",
          currentTitle: extracted.currentTitle ?? "",
          currentEmployerName: extracted.currentEmployerName ?? "",
        });
        const union = new Map<string, SkillRef>();
        for (const s of [...existingSkills, ...extracted.skills]) union.set(s.id, s);
        setAllSkillOptions(Array.from(union.values()));
        setSelectedSkillIds(new Set(union.keys()));
        setSuggestedSkillOptions(extracted.suggestedSkills.filter((s) => !union.has(s.id)));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not parse that CV");
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function toggleSkill(id: string) {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/people/${personId}`, {
        firstName: form.firstName || undefined,
        surname: form.surname || undefined,
        workEmail: form.email || undefined,
        phone: form.phone || undefined,
        currentTitle: form.currentTitle || undefined,
        currentEmployerName: form.currentEmployerName || undefined,
        skillIds: Array.from(selectedSkillIds),
      });

      const formData = new FormData();
      formData.append("file", file);
      if (existingDocId) {
        await api.post(`/api/documents/${existingDocId}/versions`, formData);
      } else {
        formData.append("type", "CANDIDATE_CV");
        formData.append("personId", personId);
        await api.post("/api/documents", formData);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        From <span className="font-medium text-slate-700">{file.name}</span> — review and correct before saving. This
        updates the candidate's fields and saves the file as {existingDocId ? "the next version" : "their first CV"}.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {parsing ? (
        <p className="text-sm text-slate-500">Parsing...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReviewField label="First name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
            <ReviewField label="Surname" value={form.surname} onChange={(v) => setForm({ ...form, surname: v })} />
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
        </>
      )}

      <div className="flex gap-2">
        <button onClick={onCancel} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
          Cancel
        </button>
        <button
          disabled={parsing || saving}
          onClick={onSave}
          className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save CV and update fields"}
        </button>
      </div>
    </div>
  );
}

function ReviewField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input className="w-full rounded border px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
