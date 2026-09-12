import { Prisma } from "@prisma/client";
import { resolveCompanyIdByName } from "./companyResolution";

// A single first name plus everything else as the surname — the same
// heuristic mainstream CRMs use converting a lead's one "full name" field
// into a real record's separate first/last name fields. Lossy for
// multi-part surnames, but there's no better signal available from a
// Target Contact's single `name` field.
function splitName(name: string): { firstName: string; surname?: string } {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, spaceIndex), surname: trimmed.slice(spaceIndex + 1).trim() || undefined };
}

// Converts a lightweight BD Opportunity into real records, run inside the
// same transaction as the stage change that triggers it (Meeting Booked or
// later — see opportunities.ts). Creates (or reuses, by name) a real Company
// via the same resolution CSV import/CV parsing use, and turns every
// not-yet-converted Target Contact into a real Client Contact Person —
// re-pointing that contact's logged interactions onto the new Person so
// nothing needs re-entering. A Target Contact already converted
// (convertedPersonId set) is left untouched; calling this again on an
// already-converted Opportunity is a safe no-op for the company (companyId
// already set short-circuits resolution).
export async function convertOpportunityToRealRecords(
  tx: Prisma.TransactionClient,
  opportunity: { id: string; companyId: string | null; prospectCompanyName: string | null }
): Promise<string> {
  const companyId = opportunity.companyId ?? (await resolveCompanyIdByName(tx, opportunity.prospectCompanyName ?? undefined));
  if (!companyId) {
    throw new Error("Cannot convert an opportunity with no company name on file");
  }

  const targetContacts = await tx.targetContact.findMany({
    where: { opportunityId: opportunity.id, convertedPersonId: null },
  });

  for (const tc of targetContacts) {
    const { firstName, surname } = splitName(tc.name);
    const person = await tx.person.create({
      data: {
        personType: "CLIENT_CONTACT",
        firstName,
        surname,
        companyId,
        jobTitle: tc.jobTitle,
        workEmail: tc.email,
        phone: tc.phone,
        linkedinUrl: tc.linkedinUrl,
      },
    });

    await tx.interaction.updateMany({
      where: { targetContactId: tc.id },
      data: { targetContactId: null, personId: person.id },
    });

    await tx.targetContact.update({ where: { id: tc.id }, data: { convertedPersonId: person.id } });
  }

  if (!opportunity.companyId) {
    await tx.opportunity.update({ where: { id: opportunity.id }, data: { companyId } });
  }

  return companyId;
}
