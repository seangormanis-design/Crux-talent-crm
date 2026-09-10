import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";

export const jobsRouter = Router();

const jobSchema = z.object({
  title: z.string().min(1),
  companyId: z.string().uuid(),
  level: z.string().optional(),
  location: z.string().optional(),
  workPreference: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  rateMin: z.number().optional(),
  rateMax: z.number().optional(),
  owningContactId: z.string().uuid().optional(),
  essentialSkillIds: z.array(z.string().uuid()).optional(),
  idealSkillIds: z.array(z.string().uuid()).optional(),
  roleTypeIds: z.array(z.string().uuid()).optional(),
});

const JOB_STAGES = [
  "POTENTIAL_LEAD",
  "QUALIFIED",
  "SPEC_TAKEN",
  "CV_SOURCING",
  "CVS_SENT",
  "INTERVIEWING",
  "OFFERED",
  "PLACED",
  "REJECTED",
] as const;

function toPrismaData(input: z.infer<typeof jobSchema>) {
  const { essentialSkillIds, idealSkillIds, roleTypeIds, ...rest } = input;
  return {
    ...rest,
    ...(essentialSkillIds ? { essentialSkills: { set: essentialSkillIds.map((id) => ({ id })) } } : {}),
    ...(idealSkillIds ? { idealSkills: { set: idealSkillIds.map((id) => ({ id })) } } : {}),
    ...(roleTypeIds ? { roleTypes: { set: roleTypeIds.map((id) => ({ id })) } } : {}),
  };
}

jobsRouter.get("/", async (req, res) => {
  const { q, stage, companyId, includeArchived } = req.query;

  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        includeArchived === "true" ? {} : { archivedAt: null },
        q ? { title: { contains: String(q), mode: "insensitive" } } : {},
        stage ? { stage: stage as any } : {},
        companyId ? { companyId: String(companyId) } : {},
      ],
    },
    include: { company: true, essentialSkills: true, idealSkills: true, roleTypes: true, candidates: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(jobs);
});

jobsRouter.get("/:id", async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      company: true,
      essentialSkills: true,
      idealSkills: true,
      roleTypes: true,
      owningContact: true,
      candidates: { include: { candidate: true, stageChanges: { orderBy: { createdAt: "desc" } } } },
      documents: { include: { versions: true } },
      interactions: { orderBy: { occurredAt: "desc" }, include: { person: true } },
      stageChanges: { orderBy: { createdAt: "desc" } },
      placement: true,
      tags: { include: { tag: true } },
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

jobsRouter.post("/", async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.create({ data: toPrismaData(parsed.data) as any });
  res.status(201).json(job);
});

jobsRouter.patch("/:id", async (req, res) => {
  const parsed = jobSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: toPrismaData(parsed.data as any) as any,
  });
  res.json(job);
});

// Archive: hidden from default views but fully reversible — jobs anchor
// pipeline/placement/interaction history, so there is no hard delete.
jobsRouter.post("/:id/archive", async (req, res) => {
  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() },
  });
  res.json(job);
});

jobsRouter.post("/:id/unarchive", async (req, res) => {
  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { archivedAt: null },
  });
  res.json(job);
});

const stageChangeSchema = z.object({
  stage: z.enum(JOB_STAGES),
  note: z.string().optional(),
});

// Job-level stage change — always logged as an immutable, timestamped StageChange row.
jobsRouter.post("/:id/stage", async (req: AuthenticatedRequest, res) => {
  const parsed = stageChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const current = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Job not found" });

  const [job] = await prisma.$transaction([
    prisma.job.update({ where: { id: req.params.id }, data: { stage: parsed.data.stage } }),
    prisma.stageChange.create({
      data: {
        jobId: req.params.id,
        fromStage: current.stage,
        toStage: parsed.data.stage,
        note: parsed.data.note,
        changedById: req.userId,
      },
    }),
  ]);

  res.json(job);
});
