import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";
import RecordTypeDot from "../components/RecordTypeDot";
import { COMPANY_LINK_CLASS, personLinkClass, personRecordKind } from "../lib/recordColors";

interface Results {
  people: any[];
  companies: any[];
  jobs: any[];
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [results, setResults] = useState<Results | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    api.get<Results>(`/api/search?q=${encodeURIComponent(q)}&limit=50`).then(setResults);
  }, [q]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Search</h1>
      <input
        className="mb-6 w-full max-w-md rounded border px-3 py-2 text-sm"
        placeholder="Search people, companies, jobs..."
        value={q}
        onChange={(e) => setSearchParams(e.target.value ? { q: e.target.value } : {})}
      />

      {results && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
              <li key={j.id}>
                <Link to={`/jobs/${j.id}`} className="text-blue-600">
                  {j.title}
                </Link>{" "}
                — {j.company?.name}
              </li>
            ))}
            {!results.jobs.length && <li className="text-slate-400">No matches</li>}
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
