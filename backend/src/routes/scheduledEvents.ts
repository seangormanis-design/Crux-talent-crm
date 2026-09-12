import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const scheduledEventsRouter = Router();

// Shared scheduling structure for both candidate interviews (jobCandidateId)
// and BD Opportunity meetings (opportunityId + contactId) — see the
// ScheduledEvent model comment in schema.prisma. Exactly one of
// jobCandidateId/opportunityId is required; contactId is required for a
// meeting and disallowed for an interview.
const scheduledEventBaseSchema = z.object({
  jobCandidateId: z.string().uuid().optional(),
  opportunityId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date(),
  format: z.enum(["PHONE", "VIDEO", "FACE_TO_FACE"]),
  notes: z.string().optional(),
});

// Only enforced at creation — a PATCH (editing scheduledAt/format/notes on
// an existing event) doesn't need to re-validate which parent it belongs to.
const scheduledEventSchema = scheduledEventBaseSchema.superRefine((data, ctx) => {
  const hasJobCandidate = !!data.jobCandidateId;
  const hasOpportunity = !!data.opportunityId;
  if (hasJobCandidate === hasOpportunity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Exactly one of jobCandidateId or opportunityId is required",
    });
  }
  if (hasOpportunity && !data.contactId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A Client Contact is required for a BD meeting" });
  }
  if (hasJobCandidate && data.contactId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "contactId only applies to an Opportunity meeting" });
  }
});

// Every event scheduled for one parent (a candidate-job pairing or an
// Opportunity), most recent first — the frontend numbers them (Interview 1,
// 2, ... / Meeting 1, 2, ...) by sorting ascending itself rather than
// storing a round number.
scheduledEventsRouter.get("/", async (req, res) => {
  const { jobCandidateId, opportunityId } = req.query;
  const events = await prisma.scheduledEvent.findMany({
    where: {
      jobCandidateId: jobCandidateId ? String(jobCandidateId) : undefined,
      opportunityId: opportunityId ? String(opportunityId) : undefined,
    },
    include: { contact: true },
    orderBy: { scheduledAt: "asc" },
  });
  res.json(events);
});

// Dashboard feed: every interview AND BD meeting still in the future,
// combined into one ascending list — same "no time window, just soonest
// first" convention as the follow-up reminders feed.
scheduledEventsRouter.get("/upcoming", async (_req, res) => {
  const events = await prisma.scheduledEvent.findMany({
    where: { scheduledAt: { gte: new Date() } },
    include: {
      jobCandidate: { include: { candidate: true, job: { include: { company: true } } } },
      opportunity: { include: { company: true } },
      contact: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  res.json(events);
});

scheduledEventsRouter.post("/", async (req, res) => {
  const parsed = scheduledEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const event = await prisma.scheduledEvent.create({ data: parsed.data, include: { contact: true } });
  res.status(201).json(event);
});

scheduledEventsRouter.patch("/:id", async (req, res) => {
  const parsed = scheduledEventBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const event = await prisma.scheduledEvent.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { contact: true },
  });
  res.json(event);
});

scheduledEventsRouter.delete("/:id", async (req, res) => {
  await prisma.scheduledEvent.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
