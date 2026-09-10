import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const tagsRouter = Router();

const TAGGABLE_TYPES = ["PERSON", "COMPANY", "JOB", "DOCUMENT"] as const;

tagsRouter.get("/", async (_req, res) => {
  res.json(await prisma.tag.findMany({ orderBy: { name: "asc" } }));
});

tagsRouter.post("/", async (req, res) => {
  const parsed = z.object({ name: z.string().min(1), color: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const tag = await prisma.tag.upsert({
    where: { name: parsed.data.name },
    update: {},
    create: parsed.data,
  });
  res.status(201).json(tag);
});

const linkSchema = z.object({
  tagId: z.string().uuid(),
  taggableType: z.enum(TAGGABLE_TYPES),
  taggableId: z.string().uuid(),
});

// Attach a tag to any entity (Person/Company/Job/Document) by type + id —
// this polymorphic link means new taggable entities never need a schema change.
tagsRouter.post("/links", async (req, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { tagId, taggableType, taggableId } = parsed.data;

  const link = await prisma.tagLink.create({
    data: {
      tagId,
      taggableType,
      taggableId,
      personId: taggableType === "PERSON" ? taggableId : undefined,
      companyId: taggableType === "COMPANY" ? taggableId : undefined,
      jobId: taggableType === "JOB" ? taggableId : undefined,
    },
  });

  res.status(201).json(link);
});

tagsRouter.delete("/links/:id", async (req, res) => {
  await prisma.tagLink.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// Polymorphic custom fields — add a new attribute to any entity without a migration.
const customFieldSchema = z.object({
  taggableType: z.enum(TAGGABLE_TYPES),
  taggableId: z.string().uuid(),
  key: z.string().min(1),
  value: z.string(),
});

tagsRouter.get("/custom-fields", async (req, res) => {
  const { taggableType, taggableId } = req.query;
  res.json(
    await prisma.customField.findMany({
      where: {
        taggableType: taggableType ? (taggableType as any) : undefined,
        taggableId: taggableId ? String(taggableId) : undefined,
      },
    })
  );
});

tagsRouter.put("/custom-fields", async (req, res) => {
  const parsed = customFieldSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { taggableType, taggableId, key, value } = parsed.data;

  const field = await prisma.customField.upsert({
    where: { taggableType_taggableId_key: { taggableType, taggableId, key } },
    update: { value },
    create: { taggableType, taggableId, key, value },
  });

  res.json(field);
});
