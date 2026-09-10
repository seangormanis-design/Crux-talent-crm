import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

interface StageCount {
  stage: string;
  _count: { _all: number };
}

interface DashboardData {
  pipeline: StageCount[];
  activityFeed: {
    staleJobs: any[];
    expiringDocuments: any[];
    recentInteractions: any[];
    candidatesAwaitingResponse: any[];
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/api/dashboard").then(setData);
  }, []);

  if (!data) return <p>Loading...</p>;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Pipeline by stage</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {data.pipeline.map((row) => (
            <div key={row.stage} className="rounded border bg-white p-3">
              <p className="text-xs uppercase text-slate-500">{row.stage.replaceAll("_", " ")}</p>
              <p className="text-2xl font-semibold">{row._count._all}</p>
            </div>
          ))}
        </div>
        <Link to="/pipeline" className="mt-3 inline-block text-sm text-blue-600">
          View full kanban board →
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Activity feed</h2>

        <FeedBlock title="Stale jobs (no movement in 14+ days)">
          {data.activityFeed.staleJobs.map((job) => (
            <li key={job.id}>
              <Link to={`/jobs/${job.id}`} className="text-blue-600">
                {job.title}
              </Link>{" "}
              — {job.company?.name} ({job.stage.replaceAll("_", " ")})
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Candidates awaiting response (CV sent)">
          {data.activityFeed.candidatesAwaitingResponse.map((pairing) => (
            <li key={pairing.id}>
              {pairing.candidate?.name} → {pairing.job?.title} ({pairing.job?.company?.name})
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Documents expiring soon">
          {data.activityFeed.expiringDocuments.map((doc) => (
            <li key={doc.id}>
              {doc.type.replaceAll("_", " ")} — {doc.person?.name ?? doc.company?.name} — expires{" "}
              {new Date(doc.expiresAt).toLocaleDateString()}
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Recent interactions">
          {data.activityFeed.recentInteractions.map((interaction) => (
            <li key={interaction.id}>
              {interaction.type.replaceAll("_", " ")} — {interaction.person?.name} —{" "}
              {new Date(interaction.occurredAt).toLocaleString()}
            </li>
          ))}
        </FeedBlock>
      </section>
    </div>
  );
}

function FeedBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-3">
      <p className="mb-2 text-sm font-medium text-slate-700">{title}</p>
      <ul className="space-y-1 text-sm text-slate-600">{children}</ul>
    </div>
  );
}
