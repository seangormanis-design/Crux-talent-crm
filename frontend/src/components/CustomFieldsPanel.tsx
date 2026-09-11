import { useEffect, useState } from "react";
import { api } from "../api/client";
import InlineField from "./InlineField";

interface CustomFieldRecord {
  id: string;
  key: string;
  value: string;
}

// Polymorphic custom fields (name + value) — add a new attribute to any
// Person/Company/Job record without a schema change. Values are click-to-edit
// like the rest of the app; the key is fixed once a field is created (it's
// the field's identity, upserted on by the backend).
export default function CustomFieldsPanel({
  taggableType,
  taggableId,
}: {
  taggableType: "PERSON" | "COMPANY" | "JOB";
  taggableId: string;
}) {
  const [fields, setFields] = useState<CustomFieldRecord[]>([]);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<CustomFieldRecord[]>(`/api/tags/custom-fields?taggableType=${taggableType}&taggableId=${taggableId}`)
      .then(setFields);
  }

  useEffect(load, [taggableType, taggableId]);

  async function saveValue(key: string, value: string) {
    await api.put("/api/tags/custom-fields", { taggableType, taggableId, key, value });
    load();
  }

  async function submitNew() {
    if (!newKey.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveValue(newKey.trim(), newValue.trim());
      setNewKey("");
      setNewValue("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add field");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="space-y-1">
        {fields.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <span className="w-32 shrink-0 truncate font-medium text-slate-600" title={f.key}>
              {f.key}
            </span>
            <InlineField value={f.value} placeholder="—" onSave={(v) => saveValue(f.key, v)} />
          </div>
        ))}
        {!fields.length && <p className="text-sm text-slate-400">No custom fields yet.</p>}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            className="w-32 rounded border px-2 py-1 text-sm"
            placeholder="Field name"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
          />
          <input
            className="flex-1 rounded border px-2 py-1 text-sm"
            placeholder="Value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNew();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={submitNew}
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="text-xs text-slate-500">
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
            setNewKey("");
            setNewValue("");
          }}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          + Add custom field
        </button>
      )}
    </div>
  );
}
