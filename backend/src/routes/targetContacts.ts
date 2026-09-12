import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { optionalEmail, optionalString, optionalUrl } from "../lib/zodHelpers";

export const targetContactsRouter = Router();

const targetContactSchema = z.object({
  opportunityId: z.string().uuid(),
  name: z.string().min(1),
  jobTitle: optionalString,
  email: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
});

targetContactsRouter.post("/", async (req, res) => {
  const parsed = targetContactSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const targetContact = await prisma.targetContact.create({ data: parsed.data });
  res.status(201).json(targetContact);
});

const editSchema = z.object({
  name: z.string().min(1).optional(),
  jobTitle: optionalString,
  email: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
});

// Editable up until conversion — once convertedPersonId is set, edits belong
// on the real Person record instead (this row becomes historical).
targetContactsRouter.patch("/:id", async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const targetContact = await prisma.targetContact.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(targetContact);
});

// A lightweight, disposable row (like a tag link or a scheduled event) — no
// archive concept. Deleting one also removes any interactions logged
// against it, same cascade behavior as deleting a Person's interactions.
targetContactsRouter.delete("/:id", async (req, res) => {
  await prisma.targetContact.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
