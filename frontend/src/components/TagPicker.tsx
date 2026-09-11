import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

interface AttachedLink {
  id: string;
  tag: Tag;
}

// Flat tag picker — same "add new on the fly, saves to the master list"
// idiom as Skills/Role Type, but attachment here is per-link (POST/DELETE
// one TagLink at a time) rather than a full-array replace, since the same
// master tag list is shared polymorphically across Person/Company/Job.
export default function TagPicker({
  taggableType,
  taggableId,
  attachedLinks,
  onChange,
}: {
  taggableType: "PERSON" | "COMPANY" | "JOB";
  taggableId: string;
  attachedLinks: AttachedLink[];
  onChange: () => void;
}) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadTags() {
    api.get<Tag[]>("/api/tags").then(setTags);
  }

  useEffect(loadTags, []);

  const attachedByTagId = new Map(attachedLinks.map((l) => [l.tag.id, l]));

  async function toggle(tag: Tag) {
    setSaving(true);
    setError(null);
    try {
      const existing = attachedByTagId.get(tag.id);
      if (existing) {
        await api.delete(`/api/tags/links/${existing.id}`);
      } else {
        await api.post("/api/tags/links", { tagId: tag.id, taggableType, taggableId });
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update tags");
    } finally {
      setSaving(false);
    }
  }

  async function submitNew() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const tag = await api.post<Tag>("/api/tags", { name: newName.trim() });
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))));
      // Attaching straight away — typing a new tag name here almost always
      // means "apply it to this record", not just "add it to the list".
      await api.post("/api/tags/links", { tagId: tag.id, taggableType, taggableId });
      onChange();
      setNewName("");
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add tag");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isAttached = attachedByTagId.has(tag.id);
          return (
            <label
              key={tag.id}
              className={`flex items-center gap-1.5 rounded border px-2 py-1 text-sm ${
                isAttached ? "border-slate-900 bg-slate-100" : ""
              }`}
            >
              <input type="checkbox" disabled={saving} checked={isAttached} onChange={() => toggle(tag)} />
              {tag.name}
            </label>
          );
        })}
        {!tags.length && <p className="text-sm text-slate-400">Loading tags...</p>}
      </div>

      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            className="rounded border px-2 py-1 text-sm"
            placeholder="New tag"
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
          + Add new tag
        </button>
      )}
    </div>
  );
}
