import { useEffect, useState } from "react";
import { api } from "../api/client";

interface RoleType {
  id: string;
  name: string;
}

// Flat tag picker for Role Type — same "add new on the fly, saves to the
// master list" idiom as SkillPicker, just without any tree/hierarchy.
export default function RoleTypePicker({
  selectedIds,
  onSave,
}: {
  selectedIds: string[];
  onSave: (nextIds: string[]) => Promise<void>;
}) {
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<RoleType[]>("/api/role-types").then(setRoleTypes);
  }, []);

  async function toggle(id: string) {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function submitNew() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const roleType = await api.post<RoleType>("/api/role-types", { name: newName.trim() });
      setRoleTypes((prev) => [...prev, roleType].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add role type");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {roleTypes.map((rt) => (
          <label
            key={rt.id}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-sm ${
              selectedIds.includes(rt.id) ? "border-slate-900 bg-slate-100" : ""
            }`}
          >
            <input
              type="checkbox"
              disabled={saving}
              checked={selectedIds.includes(rt.id)}
              onChange={() => toggle(rt.id)}
            />
            {rt.name}
          </label>
        ))}
        {!roleTypes.length && <p className="text-sm text-slate-400">Loading role types...</p>}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            className="rounded border px-2 py-1 text-sm"
            placeholder="New role type"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
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
            setNewName("");
          }}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          + Add new role type
        </button>
      )}
    </div>
  );
}
