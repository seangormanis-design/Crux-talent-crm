import { useEffect, useState } from "react";
import { api } from "../api/client";

interface SkillNode {
  id: string;
  name: string;
  parentId: string | null;
  children: SkillNode[];
}

interface PersonAssignment {
  skillId: string;
  isPrimary: boolean;
}

const MAX_PRIMARY = 5;

type Props =
  | { mode: "person"; personId: string; assigned: PersonAssignment[]; onChange: () => void }
  | { mode: "job"; jobId: string; essentialSkillIds: string[]; idealSkillIds: string[]; onChange: () => void };

// Shared tree-style skill picker for both a Candidate's assigned skills
// (with a Primary/Secondary flag) and a Job's essential/ideal skills.
// "Add new skill" is contextual — the + next to a node is how you say which
// parent it sits under — and saves straight to the shared master tree, so
// it's immediately available everywhere else that reads it.
export default function SkillPicker(props: Props) {
  const [tree, setTree] = useState<SkillNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingUnder, setAddingUnder] = useState<string | "root" | null>(null);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function loadTree() {
    api.get<SkillNode[]>("/api/skills/tree").then((t) => {
      setTree(t);
      setExpanded((prev) => {
        if (prev.size) return prev;
        // Expand everything on first load — the starter tree is small
        // enough that this is more useful than a wall of collapsed arrows.
        const all = new Set<string>();
        const collect = (nodes: SkillNode[]) => nodes.forEach((n) => (all.add(n.id), collect(n.children)));
        collect(t);
        return all;
      });
    });
  }

  useEffect(loadTree, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function savePersonSkills(next: PersonAssignment[]) {
    if (props.mode !== "person") return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/api/people/${props.personId}/skills`, { skills: next });
      props.onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveJobSkills(essentialIds: string[], idealIds: string[]) {
    if (props.mode !== "job") return;
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/jobs/${props.jobId}`, { essentialSkillIds: essentialIds, idealSkillIds: idealIds });
      props.onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function togglePersonSkill(skillId: string) {
    if (props.mode !== "person") return;
    const exists = props.assigned.some((a) => a.skillId === skillId);
    const next = exists
      ? props.assigned.filter((a) => a.skillId !== skillId)
      : [...props.assigned, { skillId, isPrimary: false }];
    savePersonSkills(next);
  }

  function togglePrimary(skillId: string) {
    if (props.mode !== "person") return;
    const current = props.assigned.find((a) => a.skillId === skillId);
    if (!current) return;
    const makingPrimary = !current.isPrimary;
    if (makingPrimary && props.assigned.filter((a) => a.isPrimary).length >= MAX_PRIMARY) {
      setError(`You can mark at most ${MAX_PRIMARY} skills as Primary.`);
      return;
    }
    setError(null);
    savePersonSkills(props.assigned.map((a) => (a.skillId === skillId ? { ...a, isPrimary: makingPrimary } : a)));
  }

  function toggleJobSkill(skillId: string, bucket: "essential" | "ideal") {
    if (props.mode !== "job") return;
    const essentialSet = new Set(props.essentialSkillIds);
    const idealSet = new Set(props.idealSkillIds);
    const target = bucket === "essential" ? essentialSet : idealSet;
    if (target.has(skillId)) target.delete(skillId);
    else target.add(skillId);
    saveJobSkills(Array.from(essentialSet), Array.from(idealSet));
  }

  async function submitNewSkill(parentId: string | null) {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.post("/api/skills", { name: newName.trim(), parentId });
      setNewName("");
      setAddingUnder(null);
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add skill");
    } finally {
      setSaving(false);
    }
  }

  const assignedMap = props.mode === "person" ? new Map(props.assigned.map((a) => [a.skillId, a] as const)) : null;
  const essentialSet = props.mode === "job" ? new Set(props.essentialSkillIds) : null;
  const idealSet = props.mode === "job" ? new Set(props.idealSkillIds) : null;

  function renderAddForm(parentId: string | null, depth: number) {
    return (
      <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 18 }}>
        <input
          autoFocus
          className="rounded border px-2 py-1 text-sm"
          placeholder="New skill name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitNewSkill(parentId);
            if (e.key === "Escape") setAddingUnder(null);
          }}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => submitNewSkill(parentId)}
          className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Add
        </button>
        <button type="button" onClick={() => setAddingUnder(null)} className="text-xs text-slate-500">
          Cancel
        </button>
      </div>
    );
  }

  function renderNode(node: SkillNode, depth: number) {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const assignment = assignedMap?.get(node.id);

    return (
      <div key={node.id}>
        <div className="flex flex-wrap items-center gap-2 py-0.5" style={{ paddingLeft: depth * 18 }}>
          {hasChildren ? (
            <button type="button" onClick={() => toggleExpand(node.id)} className="w-4 text-xs text-slate-400">
              {isExpanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="inline-block w-4" />
          )}

          {props.mode === "person" ? (
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                disabled={saving}
                checked={!!assignment}
                onChange={() => togglePersonSkill(node.id)}
              />
              {node.name}
            </label>
          ) : (
            <span className="text-sm">{node.name}</span>
          )}

          {props.mode === "person" && assignment && (
            <button
              type="button"
              disabled={saving}
              onClick={() => togglePrimary(node.id)}
              className={`rounded px-1.5 py-0.5 text-xs ${
                assignment.isPrimary ? "bg-amber-100 text-amber-700" : "border text-slate-500 hover:bg-slate-100"
              }`}
            >
              {assignment.isPrimary ? "★ Primary" : "Mark primary"}
            </button>
          )}

          {props.mode === "job" && (
            <>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={essentialSet!.has(node.id)}
                  onChange={() => toggleJobSkill(node.id, "essential")}
                />
                Essential
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={idealSet!.has(node.id)}
                  onChange={() => toggleJobSkill(node.id, "ideal")}
                />
                Ideal
              </label>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setAddingUnder(node.id);
              setNewName("");
            }}
            className="text-xs text-slate-400 hover:text-blue-600"
          >
            + add sub-skill
          </button>
        </div>

        {addingUnder === node.id && renderAddForm(node.id, depth + 1)}

        {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="max-h-80 overflow-y-auto rounded border p-2">
        {tree.map((node) => renderNode(node, 0))}
        {!tree.length && <p className="text-sm text-slate-400">Loading skills...</p>}
      </div>

      {addingUnder === "root" ? (
        renderAddForm(null, 0)
      ) : (
        <button
          type="button"
          onClick={() => {
            setAddingUnder("root");
            setNewName("");
          }}
          className="mt-2 text-xs text-blue-600 hover:underline"
        >
          + Add new top-level skill
        </button>
      )}
    </div>
  );
}
