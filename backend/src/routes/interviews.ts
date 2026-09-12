import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const interviewsRouter = Router();

const interviewSchema = z.object({
  jobCandidateId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  format: z.enum(["PHONE", "VIDEO", "FACE_TO_FACE"]),
  notes: z.string().optional(),
});

// Every interview scheduled for this candidate-job pairing, most recent
// first — the frontend numbers them (Interview 1, 2, ...) by sorting
// ascending itself rather than storing a round number.
interviewsRouter.get("/", async (req, res) => {
  const { jobCandidateId } = req.query;
  const interviews = await prisma.interview.findMany({
    where: jobCandidateId ? { jobCandidateId: String(jobCandidateId) } : {},
    orderBy: { scheduledAt: "asc" },
  });
  res.json(interviews);
});

// Dashboard feed: every interview still in the future, soonest first —
// same "no time window, just ascending order" convention as the follow-up
// reminders feed.
interviewsRouter.get("/upcoming", async (_req, res) => {
  const interviews = await prisma.interview.findMany({
    where: { scheduledAt: { gte: new Date() } },
    include: {
      jobCandidate: {
        include: { candidate: true, job: { include: { company: true } } },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 50,
  });
  res.json(interviews);
});

interviewsRouter.post("/", async (req, res) => {
  const parsed = interviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const interview = await prisma.interview.create({ data: parsed.data });
  res.status(201).json(interview);
});

interviewsRouter.patch("/:id", async (req, res) => {
  const parsed = interviewSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const interview = await prisma.interview.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(interview);
});

interviewsRouter.delete("/:id", async (req, res) => {
  await prisma.interview.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
