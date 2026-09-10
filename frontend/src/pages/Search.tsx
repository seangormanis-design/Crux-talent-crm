import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface Results {
  people: any[];
  companies: any[];
  jobs: any[];
  documents: any[];
  interactions: any[];
}

export default function Search() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Results | null>(null);

  async function onSearch(query: string) {
    setQ(query);
    if (!query) return setResults(null);
    setResults(await api.get<Results>(`/api/search?q=${encodeURIComponent(query)}`));
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Search</h1>
      <input
        className="mb-6 w-full max-w-md rounded border px-3 py-2 text-sm"
        placeholder="Search people, companies, jobs, documents, notes..."
        value={q}
        onChange={(e) => onSearch(e.target.value)}
      />

      {results && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ResultBlock title="People">
            {results.people.map((p) => (
              <li key={p.id}>
                <Link to={`/people/${p.id}`} className="text-blue-600">
                  {p.name}
                </Link>
              </li>
            ))}
          </ResultBlock>
          <ResultBlock title="Companies">
            {results.companies.map((c) => (
              <li key={c.id}>
                <Link to={`/companies/${c.id}`} className="text-blue-600">
                  {c.name}
                </Link>
              </li>
            ))}
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
          </ResultBlock>
          <ResultBlock title="Interactions">
            {results.interactions.map((i) => (
              <li key={i.id}>
                {i.type.replaceAll("_", " ")} — {i.person?.name} — {i.notes}
              </li>
            ))}
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
