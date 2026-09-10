import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const skillsRouter = Router();

// Flat list — used where a simple dropdown is enough (e.g. the People list
// filter). For the assignment picker, see GET /tree below.
skillsRouter.get("/", async (_req, res) => {
  const skills = await prisma.skill.findMany({ orderBy: { name: "asc" } });
  res.json(skills);
});

interface SkillTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  children: SkillTreeNode[];
}

// Nested tree for the picker: any depth, built from the flat table in one
// query rather than N+1 recursive queries.
skillsRouter.get("/tree", async (_req, res) => {
  const all = await prisma.skill.findMany({ orderBy: { name: "asc" } });

  const byId = new Map<string, SkillTreeNode>(all.map((s) => [s.id, { ...s, children: [] }]));
  const roots: SkillTreeNode[] = [];

  for (const skill of byId.values()) {
    if (skill.parentId && byId.has(skill.parentId)) {
      byId.get(skill.parentId)!.children.push(skill);
    } else {
      roots.push(skill);
    }
  }

  res.json(roots);
});

const skillSchema = z.object({
  name: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
});

// Skills are an extensible tag tree — a new one (at any depth, under any
// existing parent) is added here at any time without a schema change, and
// is immediately available everywhere else that reads the tree/flat list.
skillsRouter.post("/", async (req, res) => {
  const parsed = skillSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const skill = await prisma.skill.upsert({
    where: { name: parsed.data.name },
    update: parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId } : {},
    create: { name: parsed.data.name, parentId: parsed.data.parentId ?? null },
  });
  res.status(201).json(skill);
});
