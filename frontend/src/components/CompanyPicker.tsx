import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

export interface CompanyOption {
  id: string;
  name: string;
}

// Searchable company picker with an on-the-fly "create new company" option —
// used anywhere a record needs to link to a Company but the user may not
// have created it yet (e.g. quick-add forms, before the full record exists
// to attach a company to afterwards).
export default function CompanyPicker({
  value,
  onChange,
  placeholder = "Search companies...",
}: {
  value: CompanyOption | null;
  onChange: (company: CompanyOption | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [options, setOptions] = useState<CompanyOption[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.id]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      api.get<CompanyOption[]>(`/api/companies?q=${encodeURIComponent(query)}`).then(setOptions);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function createCompany() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const company = await api.post<CompanyOption>("/api/companies", { name });
      onChange(company);
      setQuery(company.name);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const exactMatch = options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full rounded border px-3 py-2 text-sm"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border bg-white shadow-lg">
          {options.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => {
                onChange(o);
                setQuery(o.name);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
            >
              {o.name}
            </button>
          ))}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              disabled={creating}
              onClick={createCompany}
              className="block w-full border-t px-3 py-1.5 text-left text-sm text-blue-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {creating ? "Creating..." : `+ Create "${query.trim()}"`}
            </button>
          )}
          {!options.length && !query.trim() && (
            <p className="px-3 py-1.5 text-xs text-slate-400">Type to search companies</p>
          )}
        </div>
      )}
    </div>
  );
}
