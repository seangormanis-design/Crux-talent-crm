import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { convertOpportunityToRealRecords } from "../lib/opportunityConversion";

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

// A stage this far along requires a real Company on file — if the
// Opportunity is still lightweight (no companyId yet) when it first reaches
// one of these, conversion runs automatically. LOST is deliberately excluded:
// a prospect lost before ever booking a meeting stays lightweight forever,
// per the standing "never forces a lightweight record to become real" rule.
const CONVERSION_TRIGGER_STAGES = new Set(["MEETING_BOOKED", "PROPOSAL_SENT", "WON"]);

const opportunityCreateSchema = z
  .object({
    companyId: z.string().uuid().optional(),
    // Lightweight prospecting: a plain-text company name, no Company record
    // required yet — see CLAUDE.md's BD prospecting layer rule.
    companyName: z.string().optional(),
    title: z.string().min(1),
    notes: z.string().optional(),
  })
  .refine((data) => !!data.companyId || !!data.companyName?.trim(), {
    message: "A company (existing or a name) is required",
    path: ["companyName"],
  });

const OPPORTUNITY_INCLUDE = {
  company: { include: { contacts: { where: { deletedAt: null } } } },
  scheduledEvents: { include: { contact: true }, orderBy: { scheduledAt: "asc" as const } },
  targetContacts: {
    include: {
      convertedPerson: true,
      interactions: { orderBy: { occurredAt: "desc" as const } },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

// Never filtered out or archived — a Lost opportunity stays visible and
// searchable in case it's worth revisiting later, so (unlike Jobs/Companies)
// there is no includeArchived-style toggle here at all.
opportunitiesRouter.get("/", async (req, res) => {
  const { companyId } = req.query;

  const opportunities = await prisma.opportunity.findMany({
    where: companyId ? { companyId: String(companyId) } : {},
    include: OPPORTUNITY_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  res.json(opportunities);
});

// Kanban board data for the BD Funnel page: every Opportunity across every
// company, grouped by stage — same shape as GET /api/pipeline/board.
opportunitiesRouter.get("/board", async (_req, res) => {
  const opportunities = await prisma.opportunity.findMany({
    include: OPPORTUNITY_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });

  const board: Record<string, typeof opportunities> = {};
  for (const stage of OPPORTUNITY_STAGES) board[stage] = [];
  for (const opportunity of opportunities) board[opportunity.stage].push(opportunity);

  res.json(board);
});

opportunitiesRouter.get("/:id", async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: req.params.id },
    include: OPPORTUNITY_INCLUDE,
  });
  if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
  res.json(opportunity);
});

opportunitiesRouter.post("/", async (req, res) => {
  const parsed = opportunityCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { companyId, companyName, ...rest } = parsed.data;
  const opportunity = await prisma.opportunity.create({
    data: {
      ...rest,
      ...(companyId ? { companyId } : { prospectCompanyName: companyName!.trim() }),
    },
    include: OPPORTUNITY_INCLUDE,
  });
  res.status(201).json(opportunity);
});

const editSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  // Only meaningful pre-conversion — editable in case the prospect's name
  // was mistyped or learned more precisely before a real Company exists.
  prospectCompanyName: z.string().optional(),
});

opportunitiesRouter.patch("/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const opportunity = await prisma.opportunity.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: OPPORTUNITY_INCLUDE,
  });
  res.json(opportunity);
});

const stageChangeSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  lostReason: z.string().optional(),
});

// Marking Won automatically flips the linked Company's Account Status to
// Active Client — the only automatic action tied to Opportunity stage
// changes. Marking Lost just requires a reason; nothing else happens.
// Reaching Meeting Booked (or later) for the first time triggers automatic
// conversion from the lightweight prospecting layer to real records — see
// opportunityConversion.ts and CLAUDE.md.
opportunitiesRouter.post("/:id/stage", async (req, res) => {
  const parsed = stageChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (parsed.data.stage === "LOST" && !parsed.data.lostReason?.trim()) {
    return res.status(400).json({ error: "A reason is required when marking an opportunity Lost" });
  }

  const current = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Opportunity not found" });

  const needsConversion = CONVERSION_TRIGGER_STAGES.has(parsed.data.stage) && !current.companyId;
  if (needsConversion && !current.prospectCompanyName?.trim()) {
    return res.status(400).json({ error: "Add a company name before moving this opportunity to Meeting Booked" });
  }

  const opportunity = await prisma.$transaction(async (tx) => {
    const convertedCompanyId = needsConversion ? await convertOpportunityToRealRecords(tx, current) : current.companyId;

    // Runs before the opportunity update below (which re-fetches the company
    // via OPPORTUNITY_INCLUDE) so the response reflects the fresh state, not
    // what the company looked like before this transaction.
    if (parsed.data.stage === "WON" && convertedCompanyId) {
      const existingTerms = await tx.companyTerms.findUnique({ where: { companyId: convertedCompanyId } });
      await tx.company.update({
        where: { id: convertedCompanyId },
        data: {
          relationshipStatus: "ACTIVE_CLIENT",
          // Only flag a company that doesn't already have Terms on file —
          // this can be a second (or later) Won opportunity for the same
          // company, which shouldn't re-prompt for something already set up.
          needsTermsSetup: !existingTerms,
        },
      });
    }

    const updated = await tx.opportunity.update({
      where: { id: req.params.id },
      data: {
        stage: parsed.data.stage,
        // Cleared whenever the opportunity moves off Lost — a stale reason
        // would be misleading if it's later revisited and lost again.
        lostReason: parsed.data.stage === "LOST" ? parsed.data.lostReason!.trim() : null,
      },
      include: OPPORTUNITY_INCLUDE,
    });

    return updated;
  });

  res.json(opportunity);
});
