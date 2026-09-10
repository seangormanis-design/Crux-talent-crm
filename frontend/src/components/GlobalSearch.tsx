import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface Person {
  id: string;
  name: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  currentTitle?: string;
  jobTitle?: string;
}
interface Company {
  id: string;
  name: string;
}
interface Job {
  id: string;
  title: string;
  company?: { name: string };
}
interface Results {
  people: Person[];
  companies: Company[];
  jobs: Job[];
}

const EMPTY: Results = { people: [], companies: [], jobs: [] };

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(EMPTY);
      return;
    }
    const timeout = setTimeout(() => {
      api.get<Results>(`/api/search?q=${encodeURIComponent(query)}&limit=5`).then((r) => {
        setResults(r);
        setOpen(true);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToFullResults() {
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") goToFullResults();
    if (e.key === "Escape") setOpen(false);
  }

  const hasResults = results.people.length || results.companies.length || results.jobs.length;
  const totalShown = results.people.length + results.companies.length + results.jobs.length;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <input
        className="w-full rounded border px-3 py-1.5 text-sm"
        placeholder="Search people, companies, jobs..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim() && setOpen(true)}
        onKeyDown={onKeyDown}
      />

      {open && q.trim() && (
        <div className="absolute z-20 mt-1 w-full rounded border bg-white shadow-lg">
          {!hasResults ? (
            <p className="px-3 py-3 text-sm text-slate-500">No matches for "{q}"</p>
          ) : (
            <>
              <ResultGroup
                label="People"
                items={results.people.map((p) => ({
                  key: p.id,
                  to: `/people/${p.id}`,
                  primary: p.name,
                  secondary: p.currentTitle ?? p.jobTitle,
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ResultGroup
                label="Companies"
                items={results.companies.map((c) => ({ key: c.id, to: `/companies/${c.id}`, primary: c.name }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ResultGroup
                label="Jobs"
                items={results.jobs.map((j) => ({
                  key: j.id,
                  to: `/jobs/${j.id}`,
                  primary: j.title,
                  secondary: j.company?.name,
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
            </>
          )}
          <button
            onClick={goToFullResults}
            className="block w-full border-t px-3 py-2 text-left text-sm text-blue-600 hover:bg-slate-50"
          >
            See all results for "{q}" →
          </button>
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: { key: string; to: string; primary: string; secondary?: string }[];
  onSelect: (to: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="border-b py-1 last:border-b-0">
      <p className="px-3 py-1 text-xs font-medium uppercase text-slate-400">{label}</p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onSelect(item.to)}
          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
        >
          {item.primary}
          {item.secondary ? <span className="text-slate-400"> — {item.secondary}</span> : null}
        </button>
      ))}
    </div>
  );
}
