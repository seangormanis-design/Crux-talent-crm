import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const companiesRouter = Router();

const companySchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  industry: z.string().optional(),
  companyType: z.enum(["PARTNER", "ISV", "CONSULTANCY", "END_USER"]).optional(),
  size: z.string().optional(),
  hqLocation: z.string().optional(),
  relationshipStatus: z.enum(["PROSPECT", "ACTIVE_CLIENT", "DORMANT", "DO_NOT_CONTACT"]).optional(),
  notes: z.string().optional(),
});

companiesRouter.get("/", async (req, res) => {
  const { q, relationshipStatus, companyType } = req.query;

  const companies = await prisma.company.findMany({
    where: {
      AND: [
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
      contacts: true,
      jobs: true,
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

// No hard delete for companies — they anchor jobs/interactions/documents history.
// Use relationshipStatus = DO_NOT_CONTACT instead.
