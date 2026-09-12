import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { fullName } from "../lib/personName";

interface CandidateOption {
  id: string;
  firstName: string;
  surname?: string | null;
  currentEmployer?: { name: string } | null;
}

// Search-as-you-type picker for adding a candidate to a job's pipeline in one
// click — searches server-side (via /api/people?q=) rather than loading every
// candidate into the browser, so it scales to hundreds of candidates without
// a list to scroll through.
export default function CandidatePipelinePicker({
  excludeIds,
  onAdd,
}: {
  excludeIds: string[];
  onAdd: (candidateId: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CandidateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .get<CandidateOption[]>(`/api/people?personType=CANDIDATE&q=${encodeURIComponent(query.trim())}`)
        .then((people) => setResults(people.filter((p) => !excludeIds.includes(p.id))))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, excludeIds]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function pick(candidate: CandidateOption) {
    setAdding(candidate.id);
    try {
      await onAdd(candidate.id);
      setQuery("");
      setResults([]);
      setOpen(false);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        className="w-full rounded border px-2 py-1.5 text-sm"
        placeholder="Search candidates to add..."
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border bg-white shadow-lg">
          {results.map((c) => (
            <button
              type="button"
              key={c.id}
              disabled={adding !== null}
              onClick={() => pick(c)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <span>{fullName(c)}</span>
              {c.currentEmployer?.name && <span className="text-xs text-slate-400">{c.currentEmployer.name}</span>}
            </button>
          ))}
          {!results.length && (
            <p className="px-3 py-1.5 text-xs text-slate-400">
              {loading ? "Searching..." : "No matching candidates"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
