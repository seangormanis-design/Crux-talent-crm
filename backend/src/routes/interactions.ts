import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";

export const interactionsRouter = Router();

const INTERACTION_TYPES = [
  "PHONE_CALL",
  "VIDEO_MEETING",
  "FACE_TO_FACE",
  "QUALIFICATION_CALL",
  "LINKEDIN_MESSAGE",
  "EMAIL",
  "TEXT",
] as const;

const interactionSchema = z.object({
  type: z.enum(INTERACTION_TYPES),
  personId: z.string().uuid(),
  jobId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  notes: z.string().optional(),
  occurredAt: z.coerce.date().optional(),
});

interactionsRouter.get("/", async (req, res) => {
  const { personId, jobId, companyId } = req.query;

  const interactions = await prisma.interaction.findMany({
    where: {
      personId: personId ? String(personId) : undefined,
      jobId: jobId ? String(jobId) : undefined,
      companyId: companyId ? String(companyId) : undefined,
    },
    include: { person: true, job: true, company: true },
    orderBy: { occurredAt: "desc" },
  });

  res.json(interactions);
});

// Interactions are append-only: there is no PATCH/DELETE route. Log a
// follow-up interaction instead of editing history.
interactionsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = interactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const interaction = await prisma.interaction.create({
    data: { ...parsed.data, createdById: req.userId },
  });

  res.status(201).json(interaction);
});
