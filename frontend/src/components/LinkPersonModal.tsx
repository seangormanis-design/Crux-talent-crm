import { useState } from "react";
import { api } from "../api/client";
import { fullName } from "../lib/personName";

interface SearchResult {
  id: string;
  firstName: string;
  surname?: string;
  workEmail?: string;
  currentEmployer?: { name: string } | null;
  company?: { name: string } | null;
}

export default function LinkPersonModal({
  personId,
  targetType,
  onLinked,
  onCancel,
}: {
  personId: string;
  targetType: "CANDIDATE" | "CLIENT_CONTACT";
  onLinked: () => void;
  onCancel: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const targetLabel = targetType === "CANDIDATE" ? "candidate" : "client contact";

  async function search(query: string) {
    setQ(query);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const people = await api.get<SearchResult[]>(
      `/api/people?personType=${targetType}&q=${encodeURIComponent(query)}`
    );
    setResults(people.filter((p) => p.id !== personId));
  }

  async function link(targetPersonId: string) {
    setLinking(true);
    setError(null);
    try {
      await api.post(`/api/people/${personId}/link`, { targetPersonId });
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not link that record");
      setLinking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Link to existing {targetLabel}</h2>
        <p className="mb-3 text-sm text-slate-500">
          Search for the {targetLabel} record that's the same person.
        </p>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <input
          autoFocus
          className="mb-3 w-full rounded border px-3 py-2 text-sm"
          placeholder="Search by name or email..."
          value={q}
          onChange={(e) => search(e.target.value)}
        />
        <div className="mb-4 max-h-64 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={linking}
              onClick={() => link(p.id)}
              className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <span>{fullName(p)}</span>
              <span className="text-xs text-slate-400">
                {p.workEmail ?? p.currentEmployer?.name ?? p.company?.name ?? ""}
              </span>
            </button>
          ))}
          {q.trim() && !results.length && <p className="text-sm text-slate-400">No matches.</p>}
        </div>
        <div className="flex justify-end border-t pt-3">
          <button onClick={onCancel} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
