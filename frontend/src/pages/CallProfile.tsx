import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function CallProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get("/api/call-profile")
      .then(setProfile)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const updated = await api.post("/api/call-profile/refresh");
      setProfile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My call review profile</h1>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        A rolling summary of patterns in your reactions to call reflections — what you tend to miss, what you
        already do well, and what kinds of feedback you've dismissed as not useful. It refreshes automatically on a
        rolling basis as you react to reflections, and feeds into every future one.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : profile ? (
        <div className="whitespace-pre-wrap rounded border bg-white p-4 text-sm">{profile.summary}</div>
      ) : (
        <p className="rounded border bg-white p-4 text-sm text-slate-400">
          No profile yet — react to a few call reflections (👍/👎) and one will build up over time.
        </p>
      )}
    </div>
  );
}
