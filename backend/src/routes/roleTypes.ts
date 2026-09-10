import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const roleTypesRouter = Router();

roleTypesRouter.get("/", async (_req, res) => {
  const roleTypes = await prisma.roleType.findMany({ orderBy: { name: "asc" } });
  res.json(roleTypes);
});

const roleTypeSchema = z.object({ name: z.string().min(1) });

// Flat master list, same "add new on the fly" idiom as Skill: upsert-by-name
// so a new one is immediately available everywhere else that reads the list.
roleTypesRouter.post("/", async (req, res) => {
  const parsed = roleTypeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const roleType = await prisma.roleType.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: { name: parsed.data.name },
  });
  res.status(201).json(roleType);
});
