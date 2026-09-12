import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { fullName } from "../lib/personName";
import CvDropCreatePanel from "../components/CvDropCreatePanel";
import RecordTypeDot from "../components/RecordTypeDot";
import { SCHEDULED_EVENT_FORMAT_LABELS } from "../components/ScheduledEventsPanel";
import { COMPANY_LINK_CLASS, personLinkClass, personRecordKind } from "../lib/recordColors";

interface StageCount {
  stage: string;
  _count: { _all: number };
}

interface RatingCount {
  qualityRating: string;
  _count: { _all: number };
}

interface DashboardData {
  pipeline: StageCount[];
  pipelineByQualityRating: RatingCount[];
  activityFeed: {
    staleJobs: any[];
    expiringDocuments: any[];
    recentInteractions: any[];
    candidatesAwaitingResponse: any[];
    followUps: any[];
    invoicesDue: any[];
    upcomingScheduledEvents: any[];
  };
}

function isOverdue(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso) < today;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<DashboardData>("/api/dashboard").then(setData);
  }, []);

  if (!data) return <p>Loading...</p>;

  return (
    <div className="space-y-6">
      <CvDropCreatePanel />

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

        <h2 className="mb-3 mt-6 text-lg font-semibold">Pipeline by quality rating</h2>
        <div className="grid grid-cols-3 gap-3">
          {data.pipelineByQualityRating.map((row) => (
            <div key={row.qualityRating} className="rounded border bg-white p-3">
              <p className="text-xs uppercase text-slate-500">Rating {row.qualityRating}</p>
              <p className="text-2xl font-semibold">{row._count._all}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Activity feed</h2>

        <FeedBlock title="Follow-up reminders">
          {data.activityFeed.followUps.map((person) => (
            <li key={person.id} className="flex items-start gap-1.5">
              <RecordTypeDot kind={personRecordKind(person)} className="mt-1" />
              <span>
              <Link
                to={`/people/${person.id}`}
                className={isOverdue(person.followUpAt) ? "font-medium text-red-600" : personLinkClass(person)}
              >
                {fullName(person)}
              </Link>{" "}
              — {new Date(person.followUpAt).toLocaleDateString()}
              {isOverdue(person.followUpAt) ? " (overdue)" : ""}
              {person.followUpNote ? ` — ${person.followUpNote}` : ""}
              </span>
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Upcoming interviews & meetings">
          {data.activityFeed.upcomingScheduledEvents.map((event) => {
            const when = (
              <>
                {new Date(event.scheduledAt).toLocaleDateString()}{" "}
                {new Date(event.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                {SCHEDULED_EVENT_FORMAT_LABELS[event.format]}
                {event.notes ? ` — ${event.notes}` : ""}
              </>
            );
            // Same underlying ScheduledEvent — jobCandidate set means a
            // candidate interview, opportunity set means a BD meeting.
            if (event.jobCandidate) {
              return (
                <li key={event.id} className="flex items-start gap-1.5">
                  <RecordTypeDot kind="CANDIDATE" className="mt-1" />
                  <span>
                    <Link
                      to={`/people/${event.jobCandidate.candidate.id}`}
                      className={personLinkClass({ personType: "CANDIDATE" })}
                    >
                      {fullName(event.jobCandidate.candidate)}
                    </Link>{" "}
                    — {event.jobCandidate.job.title} ({event.jobCandidate.job.company?.name}) — {when}
                  </span>
                </li>
              );
            }
            return (
              <li key={event.id} className="flex items-start gap-1.5">
                <RecordTypeDot kind="COMPANY" className="mt-1" />
                <span>
                  <Link to={`/companies/${event.opportunity.company.id}`} className={COMPANY_LINK_CLASS}>
                    {event.opportunity.company.name}
                  </Link>{" "}
                  — {event.opportunity.title}
                  {event.contact ? ` — with ${fullName(event.contact)}` : ""} — {when}
                </span>
              </li>
            );
          })}
          {!data.activityFeed.upcomingScheduledEvents.length && <li className="text-slate-400">Nothing scheduled</li>}
        </FeedBlock>

        <FeedBlock title="Invoices due/overdue">
          {data.activityFeed.invoicesDue.map((placement) => (
            <li key={placement.id}>
              <Link
                to={`/companies/${placement.company.id}`}
                className={isOverdue(placement.invoiceDueDate) ? "font-medium text-red-600" : COMPANY_LINK_CLASS}
              >
                Invoice {isOverdue(placement.invoiceDueDate) ? "overdue" : "due"} for {placement.company?.name}
              </Link>{" "}
              — {fullName(placement.candidate ?? {})} placement — due{" "}
              {new Date(placement.invoiceDueDate).toLocaleDateString()}
              {isOverdue(placement.invoiceDueDate) ? " (overdue)" : ""}
            </li>
          ))}
        </FeedBlock>

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
              {fullName(pairing.candidate ?? {})} → {pairing.job?.title} ({pairing.job?.company?.name})
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Documents expiring soon">
          {data.activityFeed.expiringDocuments.map((doc) => (
            <li key={doc.id}>
              {doc.type.replaceAll("_", " ")} — {doc.person ? fullName(doc.person) : doc.company?.name} — expires{" "}
              {new Date(doc.expiresAt).toLocaleDateString()}
            </li>
          ))}
        </FeedBlock>

        <FeedBlock title="Recent interactions">
          {data.activityFeed.recentInteractions.map((interaction) => (
            <li key={interaction.id} className="flex items-start gap-1.5">
              {interaction.person && <RecordTypeDot kind={personRecordKind(interaction.person)} className="mt-1" />}
              <span>
                {interaction.type.replaceAll("_", " ")} —{" "}
                {interaction.person ? (
                  <Link to={`/people/${interaction.person.id}`} className={personLinkClass(interaction.person)}>
                    {fullName(interaction.person)}
                  </Link>
                ) : (
                  ""
                )}{" "}
                — {new Date(interaction.occurredAt).toLocaleString()}
              </span>
            </li>
          ))}
        </FeedBlock>
      </section>
      </div>
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
