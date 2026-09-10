import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const skillsRouter = Router();

skillsRouter.get("/", async (_req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } });
  res.json(skills);
});

const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
});

// Skills are an extensible tag list — new tech tags (e.g. a new Power Platform
// module) are added here at any time without a schema change.
skillsRouter.post("/", async (req, res) => {
  const parsed = skillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const skill = await prisma.skill.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: parsed.data,
  });
  res.status(201).json(skill);
});
