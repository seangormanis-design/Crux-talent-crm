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
  email?: string | null;
  phone?: string | null;
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

      {/* Target Contacts is the primary focus of a lightweight Opportunity —
          a full-width bar, not a side column, with every contact's details
          shown directly rather than tucked behind an expand click. */}
      <TargetContactsPanel
        opportunity={opportunity}
        showAddContact={showAddContact}
        setShowAddContact={setShowAddContact}
        onChange={load}
      />

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
        </div>

        <div className="space-y-4">
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
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  async function addContact(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/target-contacts", {
      opportunityId: opportunity.id,
      name,
      jobTitle: jobTitle || undefined,
      email: email || undefined,
      phone: phone || undefined,
      linkedinUrl: linkedinUrl || undefined,
    });
    setName("");
    setJobTitle("");
    setEmail("");
    setPhone("");
    setLinkedinUrl("");
    setShowAddContact(false);
    onChange();
  }

  async function removeContact(contactId: string) {
    await api.delete(`/api/target-contacts/${contactId}`);
    onChange();
  }

  return (
    <section className="w-full rounded border bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Target Contacts</h2>
          <p className="text-xs text-slate-500">
            Lightweight — just a name to start. Log activity against one exactly as you would a full Client Contact.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddContact(!showAddContact)}
          className="shrink-0 rounded border px-3 py-1.5 text-xs hover:bg-slate-100"
        >
          {showAddContact ? "Cancel" : "+ Add target contact"}
        </button>
      </div>

      {showAddContact && (
        <form onSubmit={addContact} className="mb-3 grid grid-cols-1 gap-2 rounded border bg-slate-50 p-3 sm:grid-cols-5">
          <input
            className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Job title (optional)"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
          <input
            type="email"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="tel"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Phone (optional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            className="rounded border px-2 py-1.5 text-sm sm:col-span-4"
            placeholder="LinkedIn URL (optional)"
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
          />
          <button className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white sm:col-span-1">Add</button>
        </form>
      )}

      <div className="space-y-3">
        {opportunity.targetContacts.map((tc) => (
          <TargetContactRow key={tc.id} contact={tc} onRemove={() => removeContact(tc.id)} onChange={onChange} />
        ))}
        {!opportunity.targetContacts.length && <p className="text-slate-400">No target contacts yet</p>}
      </div>
    </section>
  );
}

// A labeled field shown only when the value is present — used so every
// filled-in Target Contact detail is plainly visible (no truncation, no
// click-to-reveal), while absent fields just don't take up space.
function ContactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs uppercase text-slate-400">{label}</span>
      <span className="text-slate-700">{children}</span>
    </span>
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
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editJobTitle, setEditJobTitle] = useState(contact.jobTitle ?? "");
  const [editEmail, setEditEmail] = useState(contact.email ?? "");
  const [editPhone, setEditPhone] = useState(contact.phone ?? "");
  const [editLinkedinUrl, setEditLinkedinUrl] = useState(contact.linkedinUrl ?? "");

  // Editable up until conversion — once this Target Contact has become a
  // real Client Contact, further edits belong on that Person record instead.
  const canEdit = !contact.convertedPersonId;

  function startEditing() {
    setEditName(contact.name);
    setEditJobTitle(contact.jobTitle ?? "");
    setEditEmail(contact.email ?? "");
    setEditPhone(contact.phone ?? "");
    setEditLinkedinUrl(contact.linkedinUrl ?? "");
    setEditing(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/api/target-contacts/${contact.id}`, {
      name: editName,
      jobTitle: editJobTitle || undefined,
      email: editEmail || undefined,
      phone: editPhone || undefined,
      linkedinUrl: editLinkedinUrl || undefined,
    });
    setEditing(false);
    onChange();
  }

  async function logActivity(e: FormEvent) {
    e.preventDefault();
    await api.post("/api/interactions", { targetContactId: contact.id, type, notes: notes || undefined });
    setNotes("");
    setLogging(false);
    onChange();
  }

  if (editing) {
    return (
      <form
        onSubmit={saveEdit}
        className={`w-full rounded border p-3 ${!contact.convertedPersonId ? "border-dashed border-slate-300" : ""}`}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            className="rounded border px-2 py-1.5 text-sm sm:col-span-2"
            placeholder="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            autoFocus
          />
          <input
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Job title (optional)"
            value={editJobTitle}
            onChange={(e) => setEditJobTitle(e.target.value)}
          />
          <input
            type="email"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Email (optional)"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
          />
          <input
            type="tel"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="Phone (optional)"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
          />
          <input
            className="rounded border px-2 py-1.5 text-sm sm:col-span-4"
            placeholder="LinkedIn URL (optional)"
            value={editLinkedinUrl}
            onChange={(e) => setEditLinkedinUrl(e.target.value)}
          />
          <div className="flex gap-2 sm:col-span-1">
            <button type="submit" className="rounded bg-slate-900 px-3 py-1.5 text-xs text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border px-3 py-1.5 text-xs hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className={`w-full rounded border p-3 ${!contact.convertedPersonId ? "border-dashed border-slate-300" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5">
          <p className="text-base font-medium">
            {canEdit ? (
              <button
                type="button"
                onClick={startEditing}
                className="-ml-1 rounded px-1 text-left hover:bg-slate-100"
                title="Click to edit"
              >
                {contact.name}
                {contact.jobTitle && <span className="ml-1 font-normal text-slate-500">— {contact.jobTitle}</span>}
              </button>
            ) : (
              <>
                {contact.name}
                {contact.jobTitle && <span className="ml-1 font-normal text-slate-500">— {contact.jobTitle}</span>}
              </>
            )}
            {!contact.convertedPersonId && (
              <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-normal uppercase text-slate-500">
                Prospect
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {contact.email && (
              <ContactField label="Email">
                <a href={`mailto:${contact.email}`} className="hover:underline">
                  {contact.email}
                </a>
              </ContactField>
            )}
            {contact.phone && (
              <ContactField label="Phone">
                <a href={`tel:${contact.phone}`} className="hover:underline">
                  {contact.phone}
                </a>
              </ContactField>
            )}
            {contact.linkedinUrl && (
              <ContactField label="LinkedIn">
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {contact.linkedinUrl.replace(/^https?:\/\//, "")} ↗
                </a>
              </ContactField>
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
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={startEditing} className="text-xs text-blue-600 hover:underline">
              Edit
            </button>
            <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-600" title="Remove">
              ×
            </button>
          </div>
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
        <form onSubmit={logActivity} className="mt-2 flex flex-wrap items-start gap-2">
          <select
            className="rounded border px-2 py-1 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {INTERACTION_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <textarea
            className="min-w-[16rem] flex-1 rounded border px-2 py-1 text-xs"
            placeholder="Notes"
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex gap-1">
            <button type="submit" className="rounded bg-slate-900 px-2 py-1 text-xs text-white">
              Save
            </button>
            <button
              type="button"
              onClick={() => setLogging(false)}
              className="rounded border px-2 py-1 text-xs hover:bg-slate-100"
            >
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
