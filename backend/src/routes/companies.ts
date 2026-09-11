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
    orderBy: { name: "asc" },
  });

  res.json(companies);
});

companiesRouter.get("/:id", async (req, res) => {
  const company = await prisma.company.findUnique({
    where: { id: req.params.id },
    include: {
      // Most-recent-first so the frontend can read contact[0]'s interaction
      // as "last contacted" without re-sorting.
      contacts: {
        where: { deletedAt: null },
        include: { interactions: { orderBy: { occurredAt: "desc" }, take: 1 } },
      },
      jobs: { include: { placement: true }, orderBy: { createdAt: "desc" } },
      placements: { include: { candidate: true, job: true }, orderBy: { startDate: "desc" } },
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
