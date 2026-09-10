import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const placementsRouter = Router();

const placementSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
  companyId: z.string().uuid(),
  feeType: z.enum(["PERM_PERCENTAGE", "CONTRACT_MARGIN", "DAY_RATE_UPLIFT"]),
  feeValue: z.number(),
  invoiceStatus: z.enum(["NOT_INVOICED", "INVOICED", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  renewalReviewAt: z.coerce.date().optional(),
});

placementsRouter.get("/", async (_req, res) => {
  const placements = await prisma.placement.findMany({
    include: { job: { include: { company: true } } },
    orderBy: { startDate: "desc" },
  });
  res.json(placements);
});

placementsRouter.post("/", async (req, res) => {
  const parsed = placementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [placement] = await prisma.$transaction([
    prisma.placement.create({ data: parsed.data }),
    prisma.job.update({ where: { id: parsed.data.jobId }, data: { stage: "PLACED" } }),
  ]);

  res.status(201).json(placement);
});

placementsRouter.patch("/:id", async (req, res) => {
  const parsed = placementSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const placement = await prisma.placement.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(placement);
});
