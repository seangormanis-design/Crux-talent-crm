import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const opportunitiesRouter = Router();

const OPPORTUNITY_STAGES = [
  "IDENTIFIED",
  "RESEARCHED",
  "CONTACTED",
  "MEETING_BOOKED",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
] as const;

const opportunitySchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(1),
  notes: z.string().optional(),
});

// Never filtered out or archived — a Lost opportunity stays visible and
// searchable in case it's worth revisiting later, so (unlike Jobs/Companies)
// there is no includeArchived-style toggle here at all.
opportunitiesRouter.get("/", async (req, res) => {
  const { companyId } = req.query;

  const opportunities = await prisma.opportunity.findMany({
    where: companyId ? { companyId: String(companyId) } : {},
    include: {
      company: { include: { contacts: { where: { deletedAt: null } } } },
      scheduledEvents: { include: { contact: true }, orderBy: { scheduledAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json(opportunities);
});

// Kanban board data for the BD Funnel page: every Opportunity across every
// company, grouped by stage — same shape as GET /api/pipeline/board.
opportunitiesRouter.get("/board", async (_req, res) => {
  const opportunities = await prisma.opportunity.findMany({
    include: {
      company: { include: { contacts: { where: { deletedAt: null } } } },
      scheduledEvents: { include: { contact: true }, orderBy: { scheduledAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const board: Record<string, typeof opportunities> = {};
  for (const stage of OPPORTUNITY_STAGES) board[stage] = [];
  for (const opportunity of opportunities) board[opportunity.stage].push(opportunity);

  res.json(board);
});

opportunitiesRouter.post("/", async (req, res) => {
  const parsed = opportunitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const opportunity = await prisma.opportunity.create({ data: parsed.data });
  res.status(201).json(opportunity);
});

const editSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
});

opportunitiesRouter.patch("/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const opportunity = await prisma.opportunity.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(opportunity);
});

const stageChangeSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  lostReason: z.string().optional(),
});

// Marking Won automatically flips the linked Company's Account Status to
// Active Client — the only automatic action tied to Opportunity stage
// changes. Marking Lost just requires a reason; nothing else happens.
opportunitiesRouter.post("/:id/stage", async (req, res) => {
  const parsed = stageChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.stage === "LOST" && !parsed.data.lostReason?.trim()) {
    return res.status(400).json({ error: "A reason is required when marking an opportunity Lost" });
  }

  const current = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Opportunity not found" });

  const opportunity = await prisma.$transaction(async (tx) => {
    const updated = await tx.opportunity.update({
      where: { id: req.params.id },
      data: {
        stage: parsed.data.stage,
        // Cleared whenever the opportunity moves off Lost — a stale reason
        // would be misleading if it's later revisited and lost again.
        lostReason: parsed.data.stage === "LOST" ? parsed.data.lostReason!.trim() : null,
      },
    });

    if (parsed.data.stage === "WON") {
      await tx.company.update({ where: { id: current.companyId }, data: { relationshipStatus: "ACTIVE_CLIENT" } });
    }

    return updated;
  });

  res.json(opportunity);
});
