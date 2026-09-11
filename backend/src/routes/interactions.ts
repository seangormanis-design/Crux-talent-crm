import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { optionalString } from "../lib/zodHelpers";
import { extractIntelligence } from "../lib/intelligenceExtraction";
import { reflectOnCall, refreshCallProfileIfDue } from "../lib/callReflection";
import { fullName } from "../lib/personName";
import { CLAUDE_MODEL } from "../lib/anthropicClient";

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
  // Optional Teams call transcript, pasted or uploaded at log time — can
  // also be attached later via POST /:id/transcript once it becomes available.
  transcript: optionalString,
  occurredAt: z.coerce.date().optional(),

  // Optionally set (or clear) the person's follow-up reminder in the same
  // request as logging this interaction, rather than a separate edit.
  followUpAt: z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional()),
  followUpNote: optionalString,
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

  const { followUpAt, followUpNote, ...interactionFields } = parsed.data;
  const settingFollowUp = followUpAt !== undefined;

  const [interaction] = await prisma.$transaction([
    prisma.interaction.create({
      data: { ...interactionFields, createdById: req.userId },
    }),
    ...(settingFollowUp
      ? [prisma.person.update({ where: { id: parsed.data.personId }, data: { followUpAt, followUpNote } })]
      : []),
  ]);

  res.status(201).json(interaction);
});

// Extract Intelligence: pulls people/companies mentioned, market signals,
// follow-up actions, and notable quotes out of an interaction's notes via
// the Anthropic API. A derived artifact, not part of the append-only human
// history — re-running this replaces the prior extraction rather than
// piling up duplicates.
interactionsRouter.post("/:id/extract-intelligence", async (req, res) => {
  const interaction = await prisma.interaction.findUnique({
    where: { id: req.params.id },
    include: { person: true, job: true, company: true },
  });
  if (!interaction) return res.status(404).json({ error: "Interaction not found" });
  if (!interaction.notes?.trim()) {
    return res.status(400).json({ error: "This interaction has no notes to extract from" });
  }

  let extracted;
  try {
    extracted = await extractIntelligence({
      personName: fullName(interaction.person),
      personType: interaction.person.personType,
      companyName: interaction.company?.name,
      jobTitle: interaction.job?.title,
      notes: interaction.notes,
    });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Extraction failed" });
  }

  const intelligence = await prisma.interactionIntelligence.upsert({
    where: { interactionId: interaction.id },
    update: { ...extracted, model: CLAUDE_MODEL },
    create: { interactionId: interaction.id, ...extracted, model: CLAUDE_MODEL },
  });

  res.json(intelligence);
});

interactionsRouter.get("/:id/intelligence", async (req, res) => {
  const intelligence = await prisma.interactionIntelligence.findUnique({
    where: { interactionId: req.params.id },
  });
  res.json(intelligence);
});

const transcriptSchema = z.object({ transcript: z.string().min(1) });

// A transcript can arrive after the call was already logged (Teams often
// takes a few minutes to process one) — this is the one narrow exception to
// interactions being append-only: it attaches supplementary evidence, it
// never rewrites the recruiter's own note or history.
interactionsRouter.post("/:id/transcript", async (req, res) => {
  const parsed = transcriptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const interaction = await prisma.interaction.update({
    where: { id: req.params.id },
    data: { transcript: parsed.data.transcript },
  });
  res.json(interaction);
});

// Reflect on a Qualification Call: a private, constructive critique — never
// a score — of how thoroughly the 7-section template was explored and
// whether the five core commercial questions were addressed. Uses the full
// transcript when one's attached, otherwise the written note alone (and
// says so). Re-running replaces the prior reflection, same derived-artifact
// idiom as Extract Intelligence.
interactionsRouter.post("/:id/reflect", async (req: AuthenticatedRequest, res) => {
  const interaction = await prisma.interaction.findUnique({
    where: { id: req.params.id },
    include: { person: true },
  });
  if (!interaction) return res.status(404).json({ error: "Interaction not found" });
  if (!interaction.notes?.trim()) {
    return res.status(400).json({ error: "This interaction has no notes to reflect on" });
  }

  const basis = interaction.transcript?.trim() ? "TRANSCRIPT" : "NOTE_ONLY";
  const profile = req.userId ? await prisma.userCallProfile.findUnique({ where: { userId: req.userId } }) : null;

  let content;
  try {
    content = await reflectOnCall({
      personName: fullName(interaction.person),
      notes: interaction.notes,
      transcript: interaction.transcript,
      basis,
      profileSummary: profile?.summary,
    });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Reflection failed" });
  }

  const reflection = await prisma.callReflection.upsert({
    where: { interactionId: interaction.id },
    update: { basis, content: content as any, model: CLAUDE_MODEL },
    create: { interactionId: interaction.id, basis, content: content as any, model: CLAUDE_MODEL },
  });

  res.json(reflection);
});

interactionsRouter.get("/:id/reflection", async (req, res) => {
  const reflection = await prisma.callReflection.findUnique({
    where: { interactionId: req.params.id },
    include: { feedback: true },
  });
  res.json(reflection);
});

const feedbackSchema = z.object({
  reaction: z.enum(["UP", "DOWN"]),
  comment: optionalString,
});

// Thumbs up/down (+ optional comment) on one reflection — the raw signal the
// rolling personal profile gets summarised from. Upsert: reacting again
// updates your current reaction rather than stacking duplicates.
interactionsRouter.post("/:id/reflection/feedback", async (req: AuthenticatedRequest, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const reflection = await prisma.callReflection.findUnique({ where: { interactionId: req.params.id } });
  if (!reflection) return res.status(404).json({ error: "No reflection to give feedback on" });

  const feedback = await prisma.callReflectionFeedback.upsert({
    where: { reflectionId: reflection.id },
    update: parsed.data,
    create: { reflectionId: reflection.id, ...parsed.data },
  });

  if (req.userId) await refreshCallProfileIfDue(prisma, req.userId);

  res.json(feedback);
});
