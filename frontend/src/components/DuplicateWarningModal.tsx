import { fullName } from "../lib/personName";
import { RECORD_KIND_BORDER_CLASS, personRecordKind } from "../lib/recordColors";

interface CandidateInput {
  firstName: string;
  surname?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  linkedinUrl?: string;
}

interface MatchedPerson {
  id: string;
  firstName: string;
  surname?: string;
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  linkedinUrl?: string;
  personType: "CANDIDATE" | "CLIENT_CONTACT";
}

interface Match {
  person: MatchedPerson;
  matchedOn: string[];
}

export default function DuplicateWarningModal({
  candidate,
  matches,
  onUseExisting,
  onLinkNew,
  onCreateAnyway,
  onCancel,
}: {
  candidate: CandidateInput;
  matches: Match[];
  onUseExisting: (personId: string) => void;
  onLinkNew: (personId: string) => void;
  onCreateAnyway: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold">Possible existing {matches.length > 1 ? "matches" : "match"} found</h2>
        <p className="mb-4 text-sm text-slate-500">
          Before creating "{fullName(candidate)}", check these existing records aren't the same person.
        </p>

        <div className="mb-4 space-y-3">
          {matches.map(({ person, matchedOn }) => (
            <div key={person.id} className={`rounded border border-l-4 p-3 ${RECORD_KIND_BORDER_CLASS[personRecordKind(person)]}`}>
              <p className="mb-2 text-xs font-medium uppercase text-amber-600">
                Matched on: {matchedOn.join(", ")}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  <ComparisonRow label="Name" a={fullName(candidate)} b={fullName(person)} />
                  <ComparisonRow label="Work email" a={candidate.workEmail} b={person.workEmail} />
                  <ComparisonRow label="Personal email" a={candidate.personalEmail} b={person.personalEmail} />
                  <ComparisonRow label="Phone" a={candidate.phone} b={person.phone} />
                  <ComparisonRow label="LinkedIn" a={candidate.linkedinUrl} b={person.linkedinUrl} />
                  <ComparisonRow label="Type" a="(new record)" b={person.personType === "CANDIDATE" ? "Candidate" : "Client contact"} />
                </tbody>
              </table>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onUseExisting(person.id)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
                >
                  Use existing record instead
                </button>
                <button
                  onClick={() => onLinkNew(person.id)}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100"
                >
                  Create, linked to this person
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t pt-3">
          <button onClick={onCancel} className="rounded border px-3 py-1.5 text-sm hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={onCreateAnyway} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white">
            No match — create as a new, unrelated person
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparisonRow({ label, a, b }: { label: string; a?: string; b?: string }) {
  const differs = (a ?? "") !== (b ?? "") && a && b;
  return (
    <tr className="border-t first:border-t-0">
      <td className="py-1 pr-2 text-xs uppercase text-slate-400">{label}</td>
      <td className="py-1 pr-2">{a || "—"}</td>
      <td className={`py-1 ${differs ? "text-amber-700" : ""}`}>{b || "—"}</td>
    </tr>
  );
}
