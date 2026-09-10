import { useEffect, useRef, useState } from "react";

// Click-on-the-value inline editing: no separate "edit mode" for the whole
// record, no navigating to a form — click a field, type, click/tab away (or
// Enter) to save, Escape to cancel. Each field saves independently.
export default function InlineField({
  value,
  displayValue,
  placeholder,
  onSave,
  type = "text",
  required = false,
  href,
  displayClassName = "",
  inputClassName = "",
}: {
  value: string;
  /** Shown instead of `value` when not editing (e.g. a formatted date) — the raw `value` is still what the input edits. */
  displayValue?: string;
  placeholder: string;
  onSave: (value: string) => Promise<void> | void;
  type?: string;
  required?: boolean;
  href?: string;
  displayClassName?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  async function commit() {
    setEditing(false);
    const cleaned = draft.trim();
    if (required && !cleaned) {
      setDraft(value ?? "");
      return;
    }
    if (cleaned === (value ?? "")) return;
    setSaving(true);
    try {
      await onSave(cleaned);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        autoFocus
        type={type}
        className={`w-full rounded border border-slate-400 px-2 py-1 text-sm outline-none ${inputClassName}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div className="group/field flex items-center gap-1">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`min-h-[1.75rem] flex-1 rounded px-2 py-1 text-left hover:bg-slate-100 ${displayClassName}`}
      >
        {value ? displayValue ?? value : <span className="text-slate-400">{placeholder}</span>}
      </button>
      {href && value && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open"
          className="shrink-0 px-1 text-slate-400 opacity-0 hover:text-blue-600 group-hover/field:opacity-100"
        >
          ↗
        </a>
      )}
      {saving && <span className="shrink-0 text-xs text-slate-400">Saving…</span>}
    </div>
  );
}
