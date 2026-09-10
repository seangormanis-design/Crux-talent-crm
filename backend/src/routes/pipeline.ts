import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";

export const pipelineRouter = Router();

const CANDIDATE_STAGES = ["SOURCED", "CV_SENT", "REJECTED", "INTERVIEWING", "OFFERED", "PLACED"] as const;

// Kanban board data: every job-candidate pairing grouped by its own sub-stage,
// independent of the job's overall stage.
pipelineRouter.get("/board", async (_req, res) => {
  const pairings = await prisma.jobCandidate.findMany({
    include: { job: { include: { company: true } }, candidate: true },
    orderBy: { updatedAt: "desc" },
  });

  const board: Record<string, typeof pairings> = {};
  for (const stage of CANDIDATE_STAGES) board[stage] = [];
  for (const pairing of pairings) board[pairing.stage].push(pairing);

  res.json(board);
});

const addCandidateSchema = z.object({
  jobId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

pipelineRouter.post("/", async (req, res) => {
  const parsed = addCandidateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [pairing] = await prisma.$transaction([
    prisma.jobCandidate.create({ data: parsed.data }),
  ]);

  await prisma.stageChange.create({
    data: { jobCandidateId: pairing.id, toStage: "SOURCED" },
  });

  res.status(201).json(pairing);
});

const stageChangeSchema = z.object({
  stage: z.enum(CANDIDATE_STAGES),
  note: z.string().optional(),
});

pipelineRouter.post("/:id/stage", async (req: AuthenticatedRequest, res) => {
  const parsed = stageChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const current = await prisma.jobCandidate.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Pairing not found" });

  const [pairing] = await prisma.$transaction([
    prisma.jobCandidate.update({ where: { id: req.params.id }, data: { stage: parsed.data.stage } }),
    prisma.stageChange.create({
      data: {
        jobCandidateId: req.params.id,
        fromStage: current.stage,
        toStage: parsed.data.stage,
        note: parsed.data.note,
        changedById: req.userId,
      },
    }),
  ]);

  res.json(pairing);
});
