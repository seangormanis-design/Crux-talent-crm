import { Link } from "react-router-dom";

interface MatchedJob {
  job: {
    id: string;
    title: string;
    stage: string;
    company: { id: string; name: string };
  };
}

// Job-specific rather than a generalized version of Person's
// DuplicateWarningModal — the comparison fields (title/company/stage) and
// the "same company + exact title" matching behind it are different enough
// that sharing one component would mean threading unrelated shapes through
// a single generic modal for no real benefit (only these two call sites
// exist, and each has its own record type entirely).
export default function JobDuplicateWarningModal({
  title,
  companyName,
  matches,
  onCreateAnyway,
  onCancel,
}: {
  title: string;
  companyName: string;
  matches: MatchedJob[];
  onCreateAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">
          Possible existing {matches.length > 1 ? "jobs" : "job"} found
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          "{title}" at {companyName} looks like it might already be on file — not blocking, just worth checking
          before creating another one.
        </p>

        <div className="mb-4 space-y-2">
          {matches.map(({ job }) => (
            <div key={job.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{job.title}</p>
              <p className="text-slate-500">
                {job.company.name} — {job.stage.replaceAll("_", " ")}
              </p>
              <Link to={`/jobs/${job.id}`} target="_blank" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                Open this job ↗
              </Link>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t pt-3">
          <button onClick={onCancel} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={onCreateAnyway} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            No match — create anyway
          </button>
        </div>
      </div>
    </div>
  );
}
