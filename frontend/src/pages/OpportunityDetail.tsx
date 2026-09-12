import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import InlineField from "../components/InlineField";
import OpportunityStageControl from "../components/OpportunityStageControl";
import ScheduledEventsPanel, { ScheduledEventRecord } from "../components/ScheduledEventsPanel";
import { fullName } from "../lib/personName";
import { INTERACTION_TYPE_OPTIONS } from "../lib/interactionTypes";
import { RECORD_KIND_TEXT_CLASS } from "../lib/recordColors";
import { MEETING_STAGE, Opportunity as OpportunitySummary, OpportunityCompanyLabel } from "./BdFunnel";

interface TargetContactInteraction {
  id: string;
  type: string;
  notes?: string | null;
  occurredAt: string;
}

interface TargetContact {
  id: string;
  name: string;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  convertedPersonId?: string | null;
  convertedPerson?: { id: string; firstName: string; surname?: string | null } | null;
  interactions: TargetContactInteraction[];
}

interface Opportunity extends OpportunitySummary {
  scheduledEvents: ScheduledEventRecord[];
  targetContacts: TargetContact[];
  createdAt: string;
}

export default function OpportunityDetail() {
  const { id } = useParams();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [showAddContact, setShowAddContact] = useState(false);

  function load() {
    api.get<Opportunity>(`/api/opportunities/${id}`).then((o) => {
      setOpportunity(o);
      setNotesDraft(o.notes ?? "");
    });
  }

  useEffect(load, [id]);

  async function saveField(field: string, value: string) {
    await api.patch(`/api/opportunities/${id}`, { [field]: value });
    load();
  }

  async function saveNotes() {
    await api.patch(`/api/opportunities/${id}`, { notes: notesDraft });
    load();
  }

  if (!opportunity) return <p>Loading...</p>;

  const converted = !!opportunity.company;

  return (
    <div className="space-y-6">
      <div>
        <InlineField
          value={opportunity.title}
          placeholder="Opportunity title"
          required
          onSave={(v) => saveField("title", v)}
          displayClassName="text-lg font-semibold -ml-2"
          inputClassName="text-lg font-semibold"
        />
        <p className="ml-2 mt-1 text-sm">
          <OpportunityCompanyLabel opportunity={opportunity} />
        </p>
        {!converted && (
          <p className="ml-2 mt-1 text-xs text-slate-400">
            No full Company record yet — one is created automatically (along with any Target Contacts below) once
            this reaches Meeting Booked.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded border bg-white p-3 text-sm">
            <h2 className="mb-2 font-medium">Stage</h2>
            <OpportunityStageControl opportunityId={opportunity.id} stage={opportunity.stage} onChanged={load} />
            {opportunity.stage === "LOST" && opportunity.lostReason && (
              <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-500">
                Lost: {opportunity.lostReason}
              </p>
            )}
          </section>

          {!converted && (
            <section className="rounded border bg-white p-3 text-sm">
              <h2 className="mb-2 font-medium">Prospect company name</h2>
              <InlineField
                value={opportunity.prospectCompanyName ?? ""}
                placeholder="Company name"
                onSave={(v) => saveField("prospectCompanyName", v)}
              />
            </section>
          )}

          {opportunity.stage === MEETING_STAGE && (
            <section className="rounded border bg-white p-3 text-sm">
              <h2 className="mb-2 font-medium">Meetings</h2>
              <ScheduledEventsPanel
                events={opportunity.scheduledEvents}
                parentField="opportunityId"
                parentId={opportunity.id}
                contacts={opportunity.company?.contacts ?? []}
                noun="meeting"
                onChange={load}
              />
            </section>
          )}

          <section className="rounded border bg-white p-3 text-sm">
            <h2 className="mb-2 font-medium">Notes</h2>
            <textarea
              className="w-full rounded border px-2 py-1.5 text-sm"
              rows={3}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={() => notesDraft !== (opportunity.notes ?? "") && saveNotes()}
              placeholder="Notes (optional)"
            />
          </section>
        </div>

        <div>
          <TargetContactsPanel
            opportunity={opportunity}
            showAddContact={showAddContact}
            setShowAddContact={setShowAddContact}
            onChange={load}
          />
        </div>
      </div>
    </div>
  );
}

function TargetContactsPanel({
  opportunity,
  showAddContact,
  setShowAddContact,
  onChange,
}: {
  opportunity: Opportunity;
  showAddContact: boolean;
  setShowAddContact: (v: boolean) => void;
  onChange: () => void;
}) {
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  async function addContact(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/target-contacts", {
      opportunityId: opportunity.id,
      name,
      jobTitle: jobTitle || undefined,
      linkedinUrl: linkedinUrl || undefined,
    });
    setName("");
    setJobTitle("");
    setLinkedinUrl("");
    setShowAddContact(false);
    onChange();
  }

  async function removeContact(contactId: string) {
    await api.delete(`/api/target-contacts/${contactId}`);
    onChange();
  }

  return (
    <section className="rounded border bg-white p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="font-medium">Target Contacts</h2>
          <p className="text-xs text-slate-500">
            Lightweight — just a name to start. Log activity against one exactly as you would a full Client Contact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddContact(!showAddContact)}
          className="shrink-0 rounded border px-2 py-1 text-xs hover:bg-slate-100"
        >
          {showAddContact ? "Cancel" : "+ Add target contact"}
        </button>
      </div>

      {showAddContact && (
        <form onSubmit={addContact} className="mb-3 space-y-2 rounded border bg-slate-50 p-2">
          <input
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <input
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="Job title (optional)"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          <input
            className="w-full rounded border px-2 py-1.5 text-sm"
            placeholder="LinkedIn URL (optional)"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white">Add</button>
        </form>
      )}

      <div className="space-y-2">
        {opportunity.targetContacts.map((tc) => (
          <TargetContactRow key={tc.id} contact={tc} onRemove={() => removeContact(tc.id)} onChange={onChange} />
        ))}
        {!opportunity.targetContacts.length && <p className="text-slate-400">No target contacts yet</p>}
      </div>
    </section>
  );
}

function TargetContactRow({
  contact,
  onRemove,
  onChange,
}: {
  contact: TargetContact;
  onRemove: () => void;
  onChange: () => void;
}) {
  const [logging, setLogging] = useState(false);
  const [type, setType] = useState("PHONE_CALL");
  const [notes, setNotes] = useState("");

  async function logActivity(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/interactions", { targetContactId: contact.id, type, notes: notes || undefined });
    setNotes("");
    setLogging(false);
    onChange();
  }

  return (
    <div className={`rounded border p-2 ${!contact.convertedPersonId ? "border-dashed border-slate-300" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {contact.name}
            {contact.jobTitle && <span className="font-normal text-slate-500"> — {contact.jobTitle}</span>}
            {!contact.convertedPersonId && (
              <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-normal uppercase text-slate-500">
                Prospect
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {contact.linkedinUrl && (
              <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                LinkedIn ↗
              </a>
            )}
            {contact.convertedPerson && (
              <Link
                to={`/people/${contact.convertedPerson.id}`}
                className={`${RECORD_KIND_TEXT_CLASS.CLIENT_CONTACT} hover:underline`}
              >
                Converted → {fullName(contact.convertedPerson)}
              </Link>
            )}
          </div>
        </div>
        {!contact.convertedPersonId && (
          <button type="button" onClick={onRemove} className="shrink-0 text-slate-400 hover:text-red-600" title="Remove">
            ×
          </button>
        )}
      </div>

      {!!contact.interactions.length && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {contact.interactions.map((i) => (
            <li key={i.id}>
              <span className="text-slate-400">{new Date(i.occurredAt).toLocaleString()}</span> —{" "}
              {i.type.replaceAll("_", " ")}
              {i.notes && <> — {i.notes}</>}
            </li>
          ))}
        </ul>
      )}

      {logging ? (
        <form onSubmit={logActivity} className="mt-2 space-y-1">
          <select className="w-full rounded border px-2 py-1 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
            {INTERACTION_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <textarea
            className="w-full rounded border px-2 py-1 text-xs"
            placeholder="Notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-1">
            <button type="submit" className="rounded bg-slate-900 px-2 py-1 text-xs text-white">
              Save
            </button>
            <button type="button" onClick={() => setLogging(false)} className="rounded border px-2 py-1 text-xs hover:bg-slate-100">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setLogging(true)} className="mt-2 text-xs text-blue-600 hover:underline">
          + Log activity
        </button>
      )}
    </div>
  );
}
