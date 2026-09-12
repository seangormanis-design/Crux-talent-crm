import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { fullName } from "../lib/personName";

export const SCHEDULED_EVENT_FORMAT_LABELS: Record<string, string> = {
  PHONE: "Phone",
  VIDEO: "Video/Teams",
  FACE_TO_FACE: "Face to Face",
};

export interface ScheduledEventContact {
  id: string;
  firstName: string;
  surname?: string | null;
}

export interface ScheduledEventRecord {
  id: string;
  scheduledAt: string;
  format: string;
  notes?: string | null;
  contact?: ScheduledEventContact | null;
}

// Shared scheduling UI for both candidate interviews (JobCandidate) and BD
// Opportunity meetings — same underlying /api/scheduled-events structure, so
// both are stored and displayed identically and stay ready for the same
// future calendar sync. Any future scheduled-event type should reuse this
// component rather than a new one (see CLAUDE.md).
export default function ScheduledEventsPanel({
  events,
  parentField,
  parentId,
  contacts,
  noun = "interview",
  onChange,
}: {
  events: ScheduledEventRecord[];
  parentField: "jobCandidateId" | "opportunityId";
  parentId: string;
  // Only for BD meetings — the Client Contact this meeting is with. Omit
  // entirely for candidate interviews, which have no contact field.
  contacts?: ScheduledEventContact[];
  noun?: "interview" | "meeting";
  onChange: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [format, setFormat] = useState("VIDEO");
  const [contactId, setContactId] = useState("");
  const [notes, setNotes] = useState("");

  const sorted = [...events].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const label = noun === "interview" ? "Interview" : "Meeting";

  function reset() {
    setScheduling(false);
    setDate("");
    setTime("");
    setFormat("VIDEO");
    setContactId("");
    setNotes("");
  }

  async function schedule(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/scheduled-events", {
      [parentField]: parentId,
      contactId: contacts ? contactId : undefined,
      scheduledAt: new Date(`${date}T${time || "09:00"}`).toISOString(),
      format,
      notes: notes || undefined,
    });
    reset();
    onChange();
  }

  async function remove(id: string) {
    await api.delete(`/api/scheduled-events/${id}`);
    onChange();
  }

  return (
    <div className="mt-2 border-t pt-2">
      {sorted.map((ev, idx) => (
        <div key={ev.id} className="mb-1 flex items-start justify-between gap-1">
          <p className="text-slate-600">
            {label} {idx + 1}: {new Date(ev.scheduledAt).toLocaleDateString()}{" "}
            {new Date(ev.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
            {SCHEDULED_EVENT_FORMAT_LABELS[ev.format] ?? ev.format}
            {ev.contact && <> — {fullName(ev.contact)}</>}
            {ev.notes && <span className="block text-slate-400">{ev.notes}</span>}
          </p>
          <button
            type="button"
            onClick={() => remove(ev.id)}
            className="shrink-0 text-slate-400 hover:text-red-600"
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}

      {scheduling ? (
        <form onSubmit={schedule} className="mt-1 space-y-1">
          <div className="flex gap-1">
            <input
              type="date"
              className="w-full rounded border px-1 py-1 text-xs"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <input
              type="time"
              className="w-full rounded border px-1 py-1 text-xs"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>
          <select
            className="w-full rounded border px-1 py-1 text-xs"
            value={format}
            onChange={(e) => setFormat(e.target.value)}
          >
            {Object.entries(SCHEDULED_EVENT_FORMAT_LABELS).map(([value, formatLabel]) => (
              <option key={value} value={value}>
                {formatLabel}
              </option>
            ))}
          </select>
          {contacts && (
            <select
              className="w-full rounded border px-1 py-1 text-xs"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              required
            >
              <option value="">Client contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                </option>
              ))}
            </select>
          )}
          <input
            className="w-full rounded border px-1 py-1 text-xs"
            placeholder={noun === "interview" ? "Notes (interviewer, location/link)" : "Notes (location/link, agenda)"}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-1">
            <button type="submit" className="flex-1 rounded bg-slate-900 px-2 py-1 text-xs text-white">
              Save
            </button>
            <button type="button" onClick={reset} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setScheduling(true)} className="text-blue-600 hover:underline">
          + Schedule {noun}
        </button>
      )}
    </div>
  );
}
