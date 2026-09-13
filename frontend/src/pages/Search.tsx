import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";
import RecordTypeDot from "../components/RecordTypeDot";
import SearchSnippet from "../components/SearchSnippet";
import { cvLocationLabel, noteLocationLabel, combinedSourceLabel, SearchScope } from "../components/GlobalSearch";
import { COMPANY_LINK_CLASS, JOB_LINK_CLASS, personLinkClass, personRecordKind } from "../lib/recordColors";

interface Results {
  people: any[];
  companies: any[];
  jobs: any[];
  opportunities: any[];
  cvMatches: any[];
  noteMatches: any[];
  combinedMatches: any[];
}

const SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "cvs", label: "CVs only" },
  { value: "notes", label: "Notes/Interactions only" },
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const scope = (searchParams.get("scope") as SearchScope | null) ?? "both";
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    api.get<Results>(`/api/search?q=${encodeURIComponent(q)}&limit=50&scope=${scope}`).then(setResults);
  }, [q, scope]);

  function setScope(next: SearchScope) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("scope", next);
      return params;
    });
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Search</h1>
      <input
        className="mb-3 w-full max-w-md rounded border px-3 py-2 text-sm"
        placeholder="Search people, companies, jobs..."
        value={q}
        onChange={(e) =>
          setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            if (e.target.value) params.set("q", e.target.value);
            else params.delete("q");
            return params;
          })
        }
      />
      <div className="mb-6 flex gap-1.5">
        {SCOPE_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setScope(o.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              scope === o.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 hover:bg-slate-100"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {results && scope === "both" && (
        <div className="mb-4">
          <ResultBlock title="CVs &amp; Notes">
            {results.combinedMatches.map((m: any) => (
              <li key={m.contactId} className="flex items-start gap-1.5 rounded border p-2">
                <RecordTypeDot kind={personRecordKind(m)} className="mt-1" />
                <div>
                  {m.isPerson ? (
                    <Link to={`/people/${m.contactId}`} className={personLinkClass(m)}>
                      {m.contactName}
                    </Link>
                  ) : (
                    <span className="font-medium">{m.contactName}</span>
                  )}
                  <ul className="mt-1 space-y-1">
                    {m.matchedTerms.map((t: any) => (
                      <li key={t.term} className="text-xs text-slate-500">
                        <span className="font-medium text-slate-600">{t.term}</span> — found in{" "}
                        {combinedSourceLabel(t.sources[0])}
                        {t.sources.length > 1 ? ` (+${t.sources.length - 1} more)` : ""}
                        <p className="truncate">
                          <SearchSnippet text={t.sources[0].snippet} />
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
            {!results.combinedMatches.length && <li className="text-slate-400">No matches</li>}
          </ResultBlock>
        </div>
      )}

      {results && (scope === "cvs" || scope === "notes") && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {scope === "cvs" && (
            <ResultBlock title="CVs">
              {results.cvMatches.map((m) => (
                <li key={`${m.personId}-v${m.versionNo}`} className="flex items-start gap-1.5 rounded border p-2">
                  <RecordTypeDot kind="CANDIDATE" className="mt-1" />
                  <div>
                    <Link to={`/people/${m.personId}`} className={personLinkClass({ personType: "CANDIDATE" })}>
                      {m.personName}
                    </Link>
                    <span className="text-slate-400"> — {cvLocationLabel(m)}</span>
                    <p className="mt-1 text-xs text-slate-500">
                      <SearchSnippet text={m.snippet} />
                    </p>
                  </div>
                </li>
              ))}
              {!results.cvMatches.length && <li className="text-slate-400">No matches</li>}
            </ResultBlock>
          )}
          {scope === "notes" && (
            <ResultBlock title="Notes / Interactions">
              {results.noteMatches.map((m: any, i: number) => (
                <li key={`${m.contactId}-${m.occurredAt}-${i}`} className="flex items-start gap-1.5 rounded border p-2">
                  <RecordTypeDot kind={personRecordKind(m)} className="mt-1" />
                  <div>
                    {m.isPerson ? (
                      <Link to={`/people/${m.contactId}`} className={personLinkClass(m)}>
                        {m.contactName}
                      </Link>
                    ) : (
                      <span className="font-medium">{m.contactName}</span>
                    )}
                    <span className="text-slate-400"> — {noteLocationLabel(m)}</span>
                    <p className="mt-1 text-xs text-slate-500">
                      <SearchSnippet text={m.snippet} />
                    </p>
                  </div>
                </li>
              ))}
              {!results.noteMatches.length && <li className="text-slate-400">No matches</li>}
            </ResultBlock>
          )}
        </div>
      )}

      {results && scope === "both" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <ResultBlock title="People">
            {results.people.map((p) => (
              <li key={p.id} className="flex items-start gap-1.5">
                <RecordTypeDot kind={personRecordKind(p)} className="mt-1" />
                <Link to={`/people/${p.id}`} className={personLinkClass(p)}>
                  {fullName(p)}
                </Link>
                <span className="text-slate-400">
                  {" "}
                  — {p.personType === "CANDIDATE" ? "Candidate" : "Client contact"}
                  {p.company?.name ? ` · ${p.company.name}` : ""}
                  {p.currentEmployer?.name ? ` · ${p.currentEmployer.name}` : ""}
                </span>
              </li>
            ))}
            {!results.people.length && <li className="text-slate-400">No matches</li>}
          </ResultBlock>
          <ResultBlock title="Companies">
            {results.companies.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5">
                <RecordTypeDot kind="COMPANY" />
                <Link to={`/companies/${c.id}`} className={COMPANY_LINK_CLASS}>
                  {c.name}
                </Link>
              </li>
            ))}
            {!results.companies.length && <li className="text-slate-400">No matches</li>}
          </ResultBlock>
          <ResultBlock title="Jobs">
            {results.jobs.map((j) => (
              <li key={j.id} className="flex items-center gap-1.5">
                <RecordTypeDot kind="JOB" />
                <Link to={`/jobs/${j.id}`} className={JOB_LINK_CLASS}>
                  {j.title}
                </Link>{" "}
                — {j.company?.name}
              </li>
            ))}
            {!results.jobs.length && <li className="text-slate-400">No matches</li>}
          </ResultBlock>
          <ResultBlock title="Opportunities">
            {results.opportunities.map((o) => (
              <li key={o.id} className="flex items-center gap-1.5">
                <RecordTypeDot kind="COMPANY" />
                <Link to={`/opportunities/${o.id}`} className={COMPANY_LINK_CLASS}>
                  {o.title}
                </Link>{" "}
                — {o.company?.name ?? `${o.prospectCompanyName} (prospect)`} ({o.stage.replaceAll("_", " ")})
              </li>
            ))}
            {!results.opportunities.length && <li className="text-slate-400">No matches</li>}
          </ResultBlock>
        </div>
      )}
    </div>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ul className="space-y-1 text-sm">{children}</ul>
    </div>
  );
}
