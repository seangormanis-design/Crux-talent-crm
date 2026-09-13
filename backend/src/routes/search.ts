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

// Pulls plain search terms back out of a websearch-style query (quoted
// phrases, bare words, ignoring the "OR" keyword and "-exclude" terms) —
// only used to best-effort locate which Qualification Call section a match
// falls under, not for the actual search itself.
function extractSearchTerms(query: string): string[] {
  const terms: string[] = [];
  for (const m of query.match(/"([^"]+)"/g) ?? []) terms.push(m.slice(1, -1));
  for (const word of query.replace(/"[^"]+"/g, " ").split(/\s+/)) {
    const w = word.trim();
    if (!w || w.startsWith("-") || w.toUpperCase() === "OR") continue;
    terms.push(w);
  }
  return terms;
}

function locateSection(notes: string, query: string): string | null {
  const headers: { label: string; index: number }[] = [];
  for (const label of NOTE_SECTION_LABELS) {
    const match = notes.match(new RegExp(`(?:^|\\n)${label}:`, "i"));
    if (match?.index != null) headers.push({ label, index: match.index });
  }
  if (!headers.length) return null;
  headers.sort((a, b) => a.index - b.index);

  const lowerNotes = notes.toLowerCase();
  let matchIndex = -1;
  for (const term of extractSearchTerms(query)) {
    const idx = lowerNotes.indexOf(term.toLowerCase());
    if (idx !== -1) {
      matchIndex = idx;
      break;
    }
  }
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
// websearch_to_tsquery gives Google-style query syntax for free: bare words
// are ANDed (unchanged from before), "quoted phrases" require that exact
// wording, and OR/-exclude are supported — and unlike to_tsquery it never
// throws on malformed input, which matters for a raw user-facing search box.
async function searchCvs(q: string, limit: number): Promise<CvMatch[]> {
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id,
      ts_headline('english', "extractedText", websearch_to_tsquery('english', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM document_versions
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${q})
    ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${q})) DESC
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
// See searchCvs above for why websearch_to_tsquery (quotes/OR support).
async function searchNotes(q: string, limit: number): Promise<NoteMatch[]> {
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id,
      ts_headline('english', "notes", websearch_to_tsquery('english', ${q}), ${HEADLINE_OPTIONS}) AS snippet
    FROM interactions
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${q})
    ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${q})) DESC
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

// --- Combined-pool search (scope "both") ---------------------------------
//
// A single websearch_to_tsquery @@ check only ever tests ONE row's own text
// against the WHOLE query — that's correct when only one source is toggled
// on, but wrong once both are: a candidate whose CV mentions "Azure" and
// whose call notes mention "Copilot Studio" should still match a search for
// both terms, even though neither single row satisfies the query alone.
// Instead, each atomic term (a bare word, or a "quoted phrase") from the
// query is looked up independently — still via websearch_to_tsquery on just
// that one term, so stemming/phrase-adjacency stay correct — and results
// are aggregated per contact across every one of their CV versions and
// interaction notes, before the query's AND/OR/negation structure is
// evaluated against that merged per-contact picture.

interface ParsedTerm {
  text: string;
  phrase: boolean;
  negated: boolean;
}
type OrGroup = ParsedTerm[];

// Tokenizes into bare words and "quoted phrases" (an optional leading `-`
// negates either kind), then splits into OR-groups on a bare `OR` token —
// mirrors websearch_to_tsquery's own grammar (AND within a group, OR
// between groups) since each atomic term below is still resolved through
// that same function.
function parseQuery(q: string): OrGroup[] {
  const tokens: string[] = [];
  const tokenRe = /(-)?"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(q))) {
    tokens.push(m[2] !== undefined ? `${m[1] ? "-" : ""}"${m[2]}"` : m[3]);
  }

  const groups: OrGroup[] = [[]];
  for (const tok of tokens) {
    if (tok.toUpperCase() === "OR") {
      groups.push([]);
      continue;
    }
    const negated = tok.startsWith("-");
    const rest = negated ? tok.slice(1) : tok;
    const phrase = rest.startsWith('"') && rest.endsWith('"');
    groups[groups.length - 1].push({ text: phrase ? rest.slice(1, -1) : rest, phrase, negated });
  }
  return groups.filter((g) => g.length > 0);
}

function termKey(t: Pick<ParsedTerm, "text" | "phrase">): string {
  return `${t.phrase ? "P" : "W"}:${t.text.toLowerCase()}`;
}

// Re-serializes one atomic term back into websearch syntax so a single
// term/phrase can be checked in isolation via the same operator this app
// uses everywhere else full-text search happens.
function termToTsQuery(t: Pick<ParsedTerm, "text" | "phrase">): string {
  return t.phrase ? `"${t.text}"` : t.text;
}

interface CvTermHit {
  personId: string;
  personName: string;
  documentType: string;
  versionNo: number;
  uploadedAt: Date;
  snippet: string;
}

async function findCvHitsForTerm(term: ParsedTerm): Promise<CvTermHit[]> {
  const tq = termToTsQuery(term);
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id, ts_headline('english', "extractedText", websearch_to_tsquery('english', ${tq}), ${HEADLINE_OPTIONS}) AS snippet
    FROM document_versions
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${tq})
  `;
  if (!rows.length) return [];

  const versions = await prisma.documentVersion.findMany({
    where: { id: { in: rows.map((r) => r.id) }, document: { person: { deletedAt: null, archivedAt: null } } },
    include: { document: { include: { person: true } } },
  });
  const byId = new Map(versions.map((v) => [v.id, v]));

  const hits: CvTermHit[] = [];
  for (const r of rows) {
    const v = byId.get(r.id);
    if (!v?.document.person) continue;
    hits.push({
      personId: v.document.person.id,
      personName: fullName(v.document.person),
      documentType: v.document.type,
      versionNo: v.versionNo,
      uploadedAt: v.uploadedAt,
      snippet: r.snippet,
    });
  }
  return hits;
}

interface NoteTermHit {
  contactId: string;
  contactName: string;
  isPerson: boolean;
  personType: string;
  occurredAt: Date;
  type: string;
  section: string | null;
  snippet: string;
}

async function findNoteHitsForTerm(term: ParsedTerm): Promise<NoteTermHit[]> {
  const tq = termToTsQuery(term);
  const rows = await prisma.$queryRaw<{ id: string; snippet: string }[]>`
    SELECT id, ts_headline('english', "notes", websearch_to_tsquery('english', ${tq}), ${HEADLINE_OPTIONS}) AS snippet
    FROM interactions
    WHERE "searchVector" @@ websearch_to_tsquery('english', ${tq})
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

  const hits: NoteTermHit[] = [];
  for (const r of rows) {
    const i = byId.get(r.id);
    if (!i) continue;
    const contact = i.person ?? i.targetContact;
    if (!contact || !i.notes) continue;
    hits.push({
      contactId: contact.id,
      contactName: i.person ? fullName(i.person) : i.targetContact!.name,
      isPerson: !!i.person,
      personType: i.person?.personType ?? "CLIENT_CONTACT",
      occurredAt: i.occurredAt,
      type: i.type,
      section: locateSection(i.notes, term.text),
      snippet: r.snippet,
    });
  }
  return hits;
}

type CombinedSource =
  | { kind: "cv"; documentType: string; versionNo: number; uploadedAt: Date; snippet: string }
  | { kind: "note"; interactionType: string; occurredAt: Date; section: string | null; snippet: string };

interface CombinedMatch {
  contactId: string;
  contactName: string;
  isPerson: boolean;
  personType: string;
  matchedTerms: { term: string; sources: CombinedSource[] }[];
}

async function searchCombined(q: string, limit: number): Promise<CombinedMatch[]> {
  const groups = parseQuery(q);
  const distinctTerms = new Map<string, ParsedTerm>();
  for (const group of groups) for (const term of group) distinctTerms.set(termKey(term), term);
  if (!distinctTerms.size) return [];

  const perTerm = await Promise.all(
    [...distinctTerms.values()].map(async (term) => ({
      key: termKey(term),
      term,
      cvHits: await findCvHitsForTerm(term),
      noteHits: await findNoteHitsForTerm(term),
    }))
  );

  interface ContactAccumulator {
    contactName: string;
    isPerson: boolean;
    personType: string;
    presentTerms: Map<string, { term: ParsedTerm; sources: CombinedSource[] }>;
  }
  const byContact = new Map<string, ContactAccumulator>();

  function contact(id: string, name: string, isPerson: boolean, personType: string): ContactAccumulator {
    let c = byContact.get(id);
    if (!c) {
      c = { contactName: name, isPerson, personType, presentTerms: new Map() };
      byContact.set(id, c);
    }
    return c;
  }

  for (const { key, term, cvHits, noteHits } of perTerm) {
    for (const hit of cvHits) {
      const c = contact(hit.personId, hit.personName, true, "CANDIDATE");
      const entry = c.presentTerms.get(key) ?? { term, sources: [] };
      entry.sources.push({
        kind: "cv",
        documentType: hit.documentType,
        versionNo: hit.versionNo,
        uploadedAt: hit.uploadedAt,
        snippet: hit.snippet,
      });
      c.presentTerms.set(key, entry);
    }
    for (const hit of noteHits) {
      const c = contact(hit.contactId, hit.contactName, hit.isPerson, hit.personType);
      const entry = c.presentTerms.get(key) ?? { term, sources: [] };
      entry.sources.push({ kind: "note", interactionType: hit.type, occurredAt: hit.occurredAt, section: hit.section, snippet: hit.snippet });
      c.presentTerms.set(key, entry);
    }
  }

  const matches: CombinedMatch[] = [];
  for (const [contactId, c] of byContact) {
    const isPresent = (t: ParsedTerm) => c.presentTerms.has(termKey(t));
    const satisfied = groups.some((group) => group.every((t) => (t.negated ? !isPresent(t) : isPresent(t))));
    if (!satisfied) continue;

    matches.push({
      contactId,
      contactName: c.contactName,
      isPerson: c.isPerson,
      personType: c.personType,
      matchedTerms: [...c.presentTerms.values()]
        .filter((e) => !e.term.negated)
        .map((e) => ({ term: e.term.text, sources: e.sources })),
    });
  }

  matches.sort((a, b) => b.matchedTerms.length - a.matchedTerms.length);
  return matches.slice(0, limit);
}

// A person typing "Rivera Alex" is still looking for "Alex Rivera" — every
// word of the query must appear *somewhere* among a record's searchable
// fields, but the words don't need to be in the same field or in order.
// AND-ing one OR-clause per word (rather than one `contains` on the whole
// query) is what makes that word-order-independent; a single-word query
// collapses to exactly the same single OR-clause as before.
type Contains = { contains: string; mode: "insensitive" };
function wordConditions(q: string, fields: (c: Contains) => object[]): object[] {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ OR: fields({ contains: word, mode: "insensitive" }) }));
}

// Global search: People, Companies, Jobs, and Opportunities (name/email/
// notes match, word-order-independent), plus full-text CV and interaction-
// note content. `scope` narrows to just one content source ("cvs" |
// "notes"); the default ("both") keeps the entity search and adds CV/note
// matches alongside it.
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const scope = String(req.query.scope ?? "both");
  const empty = { people: [], companies: [], jobs: [], opportunities: [], cvMatches: [], noteMatches: [], combinedMatches: [] };
  if (!q) return res.json(empty);

  const includeEntities = scope === "both";

  const [people, companies, jobs, opportunities] = includeEntities
    ? await Promise.all([
        prisma.person.findMany({
          where: {
            deletedAt: null,
            archivedAt: null,
            AND: wordConditions(q, (c) => [
              { firstName: c },
              { surname: c },
              { workEmail: c },
              { personalEmail: c },
              { phone: c },
              { motivationsText: c },
              { relationshipNotes: c },
              { jobTitle: c },
              { currentTitle: c },
              { company: { name: c } },
              { currentEmployer: { name: c } },
              { interactions: { some: { notes: c } } },
            ]),
          },
          include: { company: true, currentEmployer: true },
          take: limit,
        }),
        prisma.company.findMany({
          where: {
            archivedAt: null,
            AND: wordConditions(q, (c) => [
              { name: c },
              { notes: c },
              { contacts: { some: { OR: [{ firstName: c }, { surname: c }] } } },
              { interactions: { some: { notes: c } } },
            ]),
          },
          take: limit,
        }),
        prisma.job.findMany({
          where: {
            archivedAt: null,
            AND: wordConditions(q, (c) => [{ title: c }, { company: { name: c } }]),
          },
          include: { company: true },
          take: limit,
        }),
        prisma.opportunity.findMany({
          where: {
            AND: wordConditions(q, (c) => [
              { title: c },
              { notes: c },
              { lostReason: c },
              { company: { name: c } },
              { prospectCompanyName: c },
            ]),
          },
          include: { company: true },
          take: limit,
        }),
      ])
    : [[], [], [], []];

  // Only one of cvs/notes toggled on: a single source's own full-text
  // search is already correct (nothing to combine). Both toggled on: the
  // combined-pool search below AND-evaluates the query across every one of
  // a contact's CV versions and interaction notes together, not each source
  // separately — see searchCombined's comment.
  let cvMatches: CvMatch[] = [];
  let noteMatches: NoteMatch[] = [];
  let combinedMatches: CombinedMatch[] = [];
  if (scope === "cvs") {
    cvMatches = await searchCvs(q, limit);
  } else if (scope === "notes") {
    noteMatches = await searchNotes(q, limit);
  } else {
    combinedMatches = await searchCombined(q, limit);
  }

  res.json({ people, companies, jobs, opportunities, cvMatches, noteMatches, combinedMatches });
});
