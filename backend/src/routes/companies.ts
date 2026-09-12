import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { optionalString, optionalUrl } from "../lib/zodHelpers";

export const companiesRouter = Router();

const companySchema = z.object({
  name: z.string().min(1),
  website: optionalUrl,
  linkedinUrl: optionalUrl,
  industry: z.string().optional(),
  companyType: z.enum(["PARTNER", "ISV", "CONSULTANCY", "END_USER"]).optional(),
  size: z.string().optional(),
  hqLocation: z.string().optional(),
  addressStreet: optionalString,
  addressCity: optionalString,
  addressPostcode: optionalString,
  relationshipStatus: z.enum(["PROSPECT", "ACTIVE_CLIENT", "DORMANT", "DO_NOT_CONTACT"]).optional(),
  notes: z.string().optional(),
});

companiesRouter.get("/", async (req, res) => {
  const { q, relationshipStatus, companyType, includeArchived } = req.query;

  const companies = await prisma.company.findMany({
    where: {
      AND: [
        includeArchived === "true" ? {} : { archivedAt: null },
        q
          ? {
              OR: [
                { name: { contains: String(q), mode: "insensitive" } },
                { notes: { contains: String(q), mode: "insensitive" } },
              ],
            }
          : {},
        relationshipStatus ? { relationshipStatus: relationshipStatus as any } : {},
        companyType ? { companyType: companyType as any } : {},
      ],
    },
    // Only the latest interaction per branch is needed to compute
    // "date of last action" below — not the full history, which the detail
    // page's own aggregated timeline already covers.
    include: {
      interactions: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
      contacts: {
        where: { deletedAt: null },
        select: { interactions: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } } },
      },
      employeesAt: {
        where: { personType: "CANDIDATE", deletedAt: null },
        select: { interactions: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } } },
      },
      opportunities: {
        select: {
          targetContacts: {
            select: { interactions: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  // "Date of last action" — the most recent interaction across anyone linked
  // to this company (Client Contacts, Candidates working here, and
  // lightweight BD Target Contacts), the same aggregated data the Company
  // detail page's own activity timeline is built from.
  const shaped = companies.map((c) => {
    const dates: Date[] = [];
    for (const i of c.interactions) dates.push(i.occurredAt);
    for (const p of c.contacts) for (const i of p.interactions) dates.push(i.occurredAt);
    for (const p of c.employeesAt) for (const i of p.interactions) dates.push(i.occurredAt);
    for (const o of c.opportunities) for (const tc of o.targetContacts) for (const i of tc.interactions) dates.push(i.occurredAt);
    const lastActionAt = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    const { interactions, contacts, employeesAt, opportunities, ...rest } = c;
    return { ...rest, lastActionAt };
  });

  res.json(shaped);
});

companiesRouter.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: {
      // Most-recent-first so the frontend can read contact[0]'s interaction
      // as "last contacted" without re-sorting, and so every contact's full
      // interaction history is available to build the company-wide combined
      // activity timeline (each contact's own interactions, not just the
      // latest one).
      contacts: {
        where: { deletedAt: null },
        include: {
          interactions: { orderBy: { occurredAt: "desc" } },
          // So the frontend can flag "also linked as Candidate" — this
          // person may be the same real human as one of the entries in
          // `employeesAt` below, via the existing linked-record feature.
          linkedPerson: { select: { id: true, personType: true } },
          linkedFrom: { select: { id: true, personType: true } },
        },
      },
      // Our own Candidates who currently work here — distinct from
      // `contacts` (Client Contacts we know in a client capacity at this
      // company). A person could in principle appear on both sides.
      employeesAt: {
        where: { personType: "CANDIDATE", deletedAt: null },
        include: {
          interactions: { orderBy: { occurredAt: "desc" } },
          linkedPerson: { select: { id: true, personType: true } },
          linkedFrom: { select: { id: true, personType: true } },
        },
      },
      jobs: { include: { placement: true }, orderBy: { createdAt: "desc" } },
      placements: { include: { candidate: true, job: true }, orderBy: { startDate: "desc" } },
      opportunities: {
        include: {
          scheduledEvents: { include: { contact: true }, orderBy: { scheduledAt: "asc" } },
          // Interactions included so the company-wide activity timeline
          // below can fold in lightweight Target Contact activity, not just
          // real Contacts/Candidates.
          targetContacts: { include: { interactions: { orderBy: { occurredAt: "desc" } } } },
        },
        orderBy: { updatedAt: "desc" },
      },
      documents: { include: { versions: true } },
      interactions: { orderBy: { occurredAt: "desc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!company) return res.status(404).json({ error: "Company not found" });
  res.json(company);
});

companiesRouter.post("/", async (req, res) => {
  const parsed = companySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const company = await prisma.company.create({ data: parsed.data });
  res.status(201).json(company);
});

companiesRouter.patch("/:id", async (req, res) => {
  const parsed = companySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const company = await prisma.company.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(company);
});

// No hard delete for companies — they anchor jobs/interactions/documents
// history. Archive instead: hidden from default views, fully reversible.
companiesRouter.post("/:id/archive", async (req, res) => {
  const company = await prisma.company.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() },
  });
  res.json(company);
});

companiesRouter.post("/:id/unarchive", async (req, res) => {
  const company = await prisma.company.update({
    where: { id: req.params.id },
    data: { archivedAt: null },
  });
  res.json(company);
});
