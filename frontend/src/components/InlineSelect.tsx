import { useState } from "react";

// Click-to-edit for an enum/select field — the same fast-edit spirit as
// InlineField, but a native <select> commits immediately on choice rather
// than needing a separate blur/Enter step, since opening the dropdown is
// itself the "click to edit" gesture.
export default function InlineSelect({
  value,
  options,
  placeholder,
  onSave,
  displayClassName = "",
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onSave: (value: string) => Promise<void> | void;
  displayClassName?: string;
}) {
  const [saving, setSaving] = useState(false);

  async function handleChange(newValue: string) {
    if (newValue === value) return;
    setSaving(true);
    try {
      await onSave(newValue);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        value={value ?? ""}
        onChange={(e) => handleChange(e.target.value)}
        className={`cursor-pointer rounded border border-transparent bg-transparent px-2 py-1 text-left hover:border-slate-300 hover:bg-slate-100 ${displayClassName}`}
      >
        {!value && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {saving && <span className="text-xs text-slate-400">Saving…</span>}
    </span>
  );
}
