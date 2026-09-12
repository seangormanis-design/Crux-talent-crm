import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";
import RecordTypeDot from "./RecordTypeDot";
import SearchSnippet from "./SearchSnippet";
import { RecordKind, personRecordKind } from "../lib/recordColors";

interface Person {
  id: string;
  firstName: string;
  surname?: string;
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
interface Opportunity {
  id: string;
  title: string;
  stage: string;
  company?: { id: string; name: string };
  prospectCompanyName?: string | null;
}
interface CvMatch {
  personId: string;
  personName: string;
  documentType: string;
  versionNo: number;
  uploadedAt: string;
  snippet: string;
}
interface NoteMatch {
  contactId: string;
  contactName: string;
  isPerson: boolean;
  personType: string;
  occurredAt: string;
  type: string;
  section: string | null;
  snippet: string;
}
interface Results {
  people: Person[];
  companies: Company[];
  jobs: Job[];
  opportunities: Opportunity[];
  cvMatches: CvMatch[];
  noteMatches: NoteMatch[];
}

const EMPTY: Results = { people: [], companies: [], jobs: [], opportunities: [], cvMatches: [], noteMatches: [] };

export type SearchScope = "both" | "cvs" | "notes";
const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "cvs", label: "CVs only" },
  { value: "notes", label: "Notes only" },
];

export function cvLocationLabel(m: CvMatch): string {
  const kind = m.documentType === "CRUX_FORMATTED_CV" ? "Crux-formatted CV" : "CV";
  return `${kind} v${m.versionNo}, uploaded ${new Date(m.uploadedAt).toLocaleDateString()}`;
}

export function noteLocationLabel(m: NoteMatch): string {
  const base = `${m.type.replaceAll("_", " ").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())}, ${new Date(m.occurredAt).toLocaleDateString()}`;
  return m.section ? `${base}, ${m.section} section` : base;
}

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<SearchScope>("both");
  const [results, setResults] = useState<Results>(EMPTY);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  function runSearch(query: string, searchScope: SearchScope) {
    if (!query) {
      setResults(EMPTY);
      return;
    }
    api
      .get<Results>(`/api/search?q=${encodeURIComponent(query)}&limit=5&scope=${searchScope}`)
      .then((r) => {
        setResults(r);
        setOpen(true);
      });
  }

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(EMPTY);
      return;
    }
    const timeout = setTimeout(() => runSearch(query, scope), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, scope]);

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
    navigate(`/search?q=${encodeURIComponent(q.trim())}&scope=${scope}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") goToFullResults();
    if (e.key === "Escape") setOpen(false);
  }

  const hasResults =
    results.people.length ||
    results.companies.length ||
    results.jobs.length ||
    results.opportunities.length ||
    results.cvMatches.length ||
    results.noteMatches.length;

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
          <div className="flex gap-1 border-b p-1.5">
            {SCOPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setScope(o.value)}
                className={`rounded px-2 py-0.5 text-xs ${
                  scope === o.value ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {!hasResults ? (
            <p className="px-3 py-3 text-sm text-slate-500">No matches for "{q}"</p>
          ) : (
            <>
              <ResultGroup
                label="People"
                items={results.people.map((p) => ({
                  key: p.id,
                  to: `/people/${p.id}`,
                  primary: fullName(p),
                  secondary: p.currentTitle ?? p.jobTitle,
                  kind: personRecordKind(p),
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ResultGroup
                label="Companies"
                items={results.companies.map((c) => ({
                  key: c.id,
                  to: `/companies/${c.id}`,
                  primary: c.name,
                  kind: "COMPANY" as const,
                }))}
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
                  kind: "JOB" as const,
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ResultGroup
                label="Opportunities"
                items={results.opportunities.map((o) => ({
                  key: o.id,
                  to: `/opportunities/${o.id}`,
                  primary: o.title,
                  secondary: o.company?.name ?? (o.prospectCompanyName ? `${o.prospectCompanyName} (prospect)` : undefined),
                  kind: "COMPANY" as const,
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ContentResultGroup
                label="CVs"
                items={results.cvMatches.map((m) => ({
                  key: `${m.personId}-v${m.versionNo}`,
                  to: `/people/${m.personId}`,
                  primary: m.personName,
                  location: cvLocationLabel(m),
                  snippet: m.snippet,
                  kind: "CANDIDATE" as const,
                }))}
                onSelect={(to) => {
                  setOpen(false);
                  navigate(to);
                }}
              />
              <ContentResultGroup
                label="Notes / Interactions"
                items={results.noteMatches.map((m) => ({
                  key: `${m.contactId}-${m.occurredAt}-${m.section ?? ""}`,
                  to: m.isPerson ? `/people/${m.contactId}` : undefined,
                  primary: m.contactName,
                  location: noteLocationLabel(m),
                  snippet: m.snippet,
                  kind: personRecordKind(m),
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
  items: { key: string; to: string; primary: string; secondary?: string; kind?: RecordKind }[];
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
          className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
        >
          {item.kind && <RecordTypeDot kind={item.kind} />}
          {item.primary}
          {item.secondary ? <span className="text-slate-400"> — {item.secondary}</span> : null}
        </button>
      ))}
    </div>
  );
}

// CV/note full-text matches — distinct from ResultGroup because each item
// needs to show exactly where the match came from (a specific CV version or
// interaction, not just the record it belongs to) plus a highlighted snippet.
function ContentResultGroup({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: { key: string; to?: string; primary: string; location: string; snippet: string; kind?: RecordKind }[];
  onSelect: (to: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="border-b py-1 last:border-b-0">
      <p className="px-3 py-1 text-xs font-medium uppercase text-slate-400">{label}</p>
      {items.map((item) => {
        const body = (
          <>
            <p className="flex items-center gap-1.5 text-sm">
              {item.kind && <RecordTypeDot kind={item.kind} />}
              {item.primary} <span className="text-slate-400">— {item.location}</span>
            </p>
            <p className="truncate text-xs text-slate-500">
              <SearchSnippet text={item.snippet} />
            </p>
          </>
        );
        return item.to ? (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.to!)}
            className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
          >
            {body}
          </button>
        ) : (
          <div key={item.key} className="px-3 py-1.5">
            {body}
          </div>
        );
      })}
    </div>
  );
}
