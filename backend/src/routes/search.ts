import { Router } from "express";
import { prisma } from "../lib/prisma";
import { fullName } from "../lib/personName";

export const searchRouter = Router();

// The exact section headers buildQualificationCallNotes (People.tsx) bakes
// into Interaction.notes as plain text — used only to give a full-text note
// match a "which section" label, best-effort. A plain (non-templated) note
// has none of these, so it just falls back to no section.
const NOTE_SECTION_LABELS = ["PRESENT", "PAST", "FUTURE", "AOB", "THREATS", "LEADS", "PERSONAL INFO"];

// Plain-text delimiter instead of ts_headline's default <b>/</b> — the
// snippet is rendered client-side by splitting on this marker (odd segments
// highlighted), never as raw HTML, so nothing extracted from an uploaded
// file can inject markup into the page.
const HEADLINE_OPTIONS = "MaxWords=30,MinWords=15,ShortWord=3,StartSel=~~HL~~,StopSel=~~HL~~";

function locateSection(notes: string, query: string): string | null {
  const headers: { label: string; index: number }[] = [];
  for (const label of NOTE_SECTION_LABELS) {
    const match = notes.match(new RegExp(`(?:^|\\n)${label}:`, "i"));
    if (match?.index != null) headers.push({ label, index: match.index });
  }
  if (!headers.length) return null;
  headers.sort((a, b) => a.index - b.index);

  const matchIndex = notes.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex === -1) return null;

  let containing: string | null = null;
  for (const h of headers) {
    if (h.index <= matchIndex) containing = h.label;
    else break;
  }
  return containing;
}

interface CvMatch {
  personId: string;
  personName: string;
  documentType: string;
  versionNo: number;
  uploadedAt: Date;
  snippet: string;
}

// Every CV version, not just the current one — searchVector is a generated
// Postgres column (STORED, GIN-indexed) over DocumentVersion.extractedText,
// populated at upload time for CV document types only (see documents.ts).
async function searchCvs(q: string, limit: number): Promise<CvMatch[]> {
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id,
      ts_headline('english', "extractedText", plainto_tsquery('english', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM document_versions
    WHERE "searchVector" @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${q})) DESC
    LIMIT ${limit}
  `;
  if (!rows.length) return [];

  const versions = await prisma.documentVersion.findMany({
    where: { id: { in: rows.map((r) => r.id) }, document: { person: { deletedAt: null, archivedAt: null } } },
    include: { document: { include: { person: true } } },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));

  const matches: CvMatch[] = [];
  for (const r of rows) {
    const v = byId.get(r.id);
    if (!v?.document.person) continue;
    matches.push({
      personId: v.document.person.id,
      personName: fullName(v.document.person),
      documentType: v.document.type,
      versionNo: v.versionNo,
      uploadedAt: v.uploadedAt,
      snippet: r.snippet,
    });
  }
  return matches;
}

interface NoteMatch {
  contactId: string;
  contactName: string;
  isPerson: boolean;
  // A Target Contact (isPerson: false) is always a prospective Client
  // Contact by definition — see CLAUDE.md's BD prospecting layer rule —
  // so the colour-coding always resolves even without a real Person row.
  personType: string;
  occurredAt: Date;
  type: string;
  section: string | null;
  snippet: string;
}

// Every interaction note, including every section of a Qualification Call
// (concatenated with labeled headers into one Interaction.notes string —
// see People.tsx's buildQualificationCallNotes). searchVector is generated
// from `notes` directly, so nothing needs populating at write time here.
async function searchNotes(q: string, limit: number): Promise<NoteMatch[]> {
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id,
      ts_headline('english', "notes", plainto_tsquery('english', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM interactions
    WHERE "searchVector" @@ plainto_tsquery('english', ${q})
    ORDER BY ts_rank("searchVector", plainto_tsquery('english', ${q})) DESC
    LIMIT ${limit}
  `;
  if (!rows.length) return [];

  const interactions = await prisma.interaction.findMany({
    where: {
      id: { in: rows.map((r) => r.id) },
      OR: [{ personId: null }, { person: { deletedAt: null, archivedAt: null } }],
    },
    include: { person: true, targetContact: true },
  });
  const byId = new Map(interactions.map((i) => [i.id, i]));

  const matches: NoteMatch[] = [];
  for (const r of rows) {
    const i = byId.get(r.id);
    if (!i) continue;
    const contact = i.person ?? i.targetContact;
    if (!contact || !i.notes) continue;
    matches.push({
      contactId: contact.id,
      contactName: i.person ? fullName(i.person) : i.targetContact!.name,
      isPerson: !!i.person,
      personType: i.person?.personType ?? "CLIENT_CONTACT",
      occurredAt: i.occurredAt,
      type: i.type,
      section: locateSection(i.notes, q),
      snippet: r.snippet,
    });
  }
  return matches;
}

// Global search: People, Companies, Jobs, and Opportunities (name/email/
// notes substring match), plus full-text CV and interaction-note content.
// `scope` narrows to just one content source ("cvs" | "notes"); the default
// ("both") keeps the entity search and adds CV/note matches alongside it.
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const scope = String(req.query.scope ?? "both");
  const empty = { people: [], companies: [], jobs: [], opportunities: [], cvMatches: [], noteMatches: [] };
  if (!q) return res.json(empty);

  const contains = { contains: q, mode: "insensitive" as const };
  const includeEntities = scope === "both";
  const includeCvs = scope === "cvs" || scope === "both";
  const includeNotes = scope === "notes" || scope === "both";

  const [people, companies, jobs, opportunities] = includeEntities
    ? await Promise.all([
        prisma.person.findMany({
          where: {
            deletedAt: null,
            archivedAt: null,
            OR: [
              { firstName: contains },
              { surname: contains },
              { workEmail: contains },
              { personalEmail: contains },
              { phone: contains },
              { motivationsText: contains },
              { relationshipNotes: contains },
              { jobTitle: contains },
              { currentTitle: contains },
              { company: { name: contains } },
              { currentEmployer: { name: contains } },
              { interactions: { some: { notes: contains } } },
            ],
          },
          include: { company: true, currentEmployer: true },
          take: limit,
        }),
        prisma.company.findMany({
          where: {
            archivedAt: null,
            OR: [
              { name: contains },
              { notes: contains },
              { contacts: { some: { OR: [{ firstName: contains }, { surname: contains }] } } },
              { interactions: { some: { notes: contains } } },
            ],
          },
          take: limit,
        }),
        prisma.job.findMany({
          where: {
            archivedAt: null,
            OR: [{ title: contains }, { company: { name: contains } }],
          },
          include: { company: true },
          take: limit,
        }),
        prisma.opportunity.findMany({
          where: {
            OR: [
              { title: contains },
              { notes: contains },
              { lostReason: contains },
              { company: { name: contains } },
              { prospectCompanyName: contains },
            ],
          },
          include: { company: true },
          take: limit,
        }),
      ])
    : [[], [], [], []];

  const [cvMatches, noteMatches] = await Promise.all([
    includeCvs ? searchCvs(q, limit) : Promise.resolve([]),
    includeNotes ? searchNotes(q, limit) : Promise.resolve([]),
  ]);

  res.json({ people, companies, jobs, opportunities, cvMatches, noteMatches });
});
