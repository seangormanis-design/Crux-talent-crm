import { FormEvent, useState } from "react";
import { api } from "../api/client";
import CompanyPicker, { CompanyOption } from "./CompanyPicker";
import SkillPicker from "./SkillPicker";
import DuplicateWarningModal from "./DuplicateWarningModal";

interface CreatedPerson {
  id: string;
}

// The single, full Candidate/Client Contact creation form — used both on
// the People page and anywhere else a new person needs creating (e.g. from
// a Company's Contacts section, with the company pre-filled). There must
// only ever be this one form; a page that wants a person created from a
// different starting point should pass initialCompany, not build its own
// simplified version.
export default function PersonCreateForm({
  personType,
  initialCompany = null,
  onCreated,
}: {
  personType: "CANDIDATE" | "CLIENT_CONTACT";
  initialCompany?: CompanyOption | null;
  onCreated: (person: CreatedPerson) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [seniority, setSeniority] = useState("");
  const [location, setLocation] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [company, setCompany] = useState<CompanyOption | null>(initialCompany);
  const [duplicateMatches, setDuplicateMatches] = useState<any[] | null>(null);
  const [creating, setCreating] = useState(false);

  function toggleSkill(skillId: string) {
    setSkillIds((prev) => (prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]));
  }

  async function createPerson(linkedPersonId?: string) {
    setCreating(true);
    try {
      const person = await api.post<CreatedPerson>("/api/people", {
        firstName,
        surname: surname || undefined,
        personType,
        workEmail: workEmail || undefined,
        personalEmail: personalEmail || undefined,
        phone: phone || undefined,
        linkedinUrl: linkedinUrl || undefined,
        addressStreet: addressStreet || undefined,
        addressCity: addressCity || undefined,
        addressPostcode: addressPostcode || undefined,
        ...(personType === "CANDIDATE"
          ? {
              seniority: seniority || undefined,
              location: location || undefined,
              skillIds: skillIds.length ? skillIds : undefined,
              currentEmployerId: company?.id || undefined,
            }
          : {
              companyId: company?.id || undefined,
              jobTitle: jobTitle || undefined,
            }),
        linkedPersonId,
      });
      onCreated(person);
    } finally {
      setCreating(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const { matches } = await api.post<{ matches: any[] }>("/api/people/check-duplicates", {
      firstName,
      surname: surname || undefined,
      workEmail: workEmail || undefined,
      personalEmail: personalEmail || undefined,
      phone: phone || undefined,
      linkedinUrl: linkedinUrl || undefined,
    });
    if (matches.length) setDuplicateMatches(matches);
    else await createPerson();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mb-4 space-y-4 rounded border bg-white p-3">
        <p className="text-xs font-medium uppercase text-slate-400">
          New {personType === "CANDIDATE" ? "Candidate" : "Client Contact"}
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            placeholder="Surname"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Contact details</p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Work email (helps catch duplicates)"
              value={workEmail}
              onChange={(e) => setWorkEmail(e.target.value)}
            />
            <input
              type="email"
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Personal email"
              value={personalEmail}
              onChange={(e) => setPersonalEmail(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="LinkedIn URL"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
            />
            <input
              className="flex-1 rounded border px-3 py-2 text-sm"
              placeholder="Street"
              value={addressStreet}
              onChange={(e) => setAddressStreet(e.target.value)}
            />
            <input
              className="w-32 rounded border px-3 py-2 text-sm"
              placeholder="City"
              value={addressCity}
              onChange={(e) => setAddressCity(e.target.value)}
            />
            <input
              className="w-28 rounded border px-3 py-2 text-sm"
              placeholder="Postcode"
              value={addressPostcode}
              onChange={(e) => setAddressPostcode(e.target.value)}
            />
          </div>
        </div>

        {personType === "CANDIDATE" && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Professional details</p>
            <div className="mb-2 flex flex-wrap gap-2">
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Seniority (e.g. Senior, Lead)"
                value={seniority}
                onChange={(e) => setSeniority(e.target.value)}
              />
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <div className="flex-1">
                <CompanyPicker value={company} onChange={setCompany} placeholder="Current employer — search or add new" />
              </div>
            </div>
            <p className="mb-1 text-xs text-slate-500">Skills (optional — mark primary/secondary later on their record)</p>
            <SkillPicker mode="draft" selectedSkillIds={skillIds} onToggle={toggleSkill} />
          </div>
        )}

        {personType === "CLIENT_CONTACT" && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase text-slate-400">Company</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1">
                <CompanyPicker value={company} onChange={setCompany} placeholder="Search or add a new company" />
              </div>
              <input
                className="flex-1 rounded border px-3 py-2 text-sm"
                placeholder="Job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
          </div>
        )}

        <button disabled={creating} className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50">
          {creating ? "Creating..." : "Create"}
        </button>
      </form>

      {duplicateMatches && (
        <DuplicateWarningModal
          candidate={{ firstName, surname, workEmail, personalEmail, phone, linkedinUrl }}
          matches={duplicateMatches}
          onUseExisting={(personId) => onCreated({ id: personId })}
          onLinkNew={(personId) => createPerson(personId)}
          onCreateAnyway={() => createPerson()}
          onCancel={() => setDuplicateMatches(null)}
        />
      )}
    </>
  );
}
