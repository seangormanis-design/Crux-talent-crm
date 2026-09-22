import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { optionalString, nullableString } from "../lib/zodHelpers";
import { extractIntelligence } from "../lib/intelligenceExtraction";
import { extractQualificationSections } from "../lib/qualificationExtraction";
import { buildQualificationCallNotes } from "../lib/qualificationSections";
import { guessSkills } from "../lib/cvExtraction";
import { reflectOnCall, refreshCallProfileIfDue } from "../lib/callReflection";
import { fullName } from "../lib/personName";
import { CLAUDE_MODEL } from "../lib/anthropicClient";

export const interactionsRouter = Router();

// Extract Intelligence and Reflect need a contact name/type regardless of
// which side of the personId/targetContactId split this interaction is on —
// a Target Contact is always a prospective Client Contact by definition.
function contactNameAndType(interaction: { person: { firstName: string; surname: string | null; personType: string } | null; targetContact: { name: string } | null }): { name: string; personType: string } {
  if (interaction.person) return { name: fullName(interaction.person), personType: interaction.person.personType };
  return { name: interaction.targetContact?.name ?? "Unknown", personType: "CLIENT_CONTACT" };
}

const INTERACTION_TYPES = [
  "PHONE_CALL",
  "VIDEO_MEETING",
  "FACE_TO_FACE",
  "QUALIFICATION_CALL",
  "LINKEDIN_MESSAGE",
  "EMAIL",
  "TEXT",
  "VOICEMAIL",
] as const;

// Exactly one of personId/targetContactId is required — a real Person or a
// lightweight BD Target Contact (see CLAUDE.md's prospecting-layer rule).
// Logging works identically either way; only the parent differs.
const interactionSchema = z
  .object({
    type: z.enum(INTERACTION_TYPES),
    personId: z.string().uuid().optional(),
    targetContactId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    companyId: z.string().uuid().optional(),
    notes: z.string().optional(),
    // The 7-section Qualification Call template — only meaningful when
    // type is QUALIFICATION_CALL. `notes` is computed server-side from
    // these (see the POST handler) rather than trusted from the client,
    // so a raw `notes` sent alongside these for that type is ignored.
    qcPresent: optionalString,
    qcPast: optionalString,
    qcFuture: optionalString,
    qcAob: optionalString,
    qcThreats: optionalString,
    qcLeads: optionalString,
    qcPersonalInfo: optionalString,
    // Optional Teams call transcript, pasted or uploaded at log time — can
    // also be attached later via POST /:id/transcript once it becomes available.
    transcript: optionalString,
    occurredAt: z.coerce.date().optional(),

    // Optionally set (or clear) the person's follow-up reminder in the same
    // request as logging this interaction, rather than a separate edit.
    // Only meaningful for a real Person — Target Contacts have no follow-up field.
    followUpAt: z.preprocess((v) => (v === "" ? null : v), z.coerce.date().nullable().optional()),
    followUpNote: optionalString,
  })
  .refine((data) => !!data.personId !== !!data.targetContactId, {
    message: "Exactly one of personId or targetContactId is required",
    path: ["personId"],
  });

interactionsRouter.get("/", async (req, res) => {
  const { personId, targetContactId, jobId, companyId } = req.query;

  const interactions = await prisma.interaction.findMany({
    where: {
      personId: personId ? String(personId) : undefined,
      targetContactId: targetContactId ? String(targetContactId) : undefined,
      jobId: jobId ? String(jobId) : undefined,
      companyId: companyId ? String(companyId) : undefined,
    },
    include: { person: true, targetContact: true, job: true, company: true, editedBy: { select: { name: true } } },
    orderBy: { occurredAt: "desc" },
  });

  res.json(interactions);
});

// Interactions were originally fully append-only; PATCH /:id below is now
// the one deliberate, tracked exception (see its comment) — there is still
// no DELETE route.
interactionsRouter.post("/", async (req: AuthenticatedRequest, res) => {
  const parsed = interactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const {
    followUpAt,
    followUpNote,
    notes: rawNotes,
    qcPresent,
    qcPast,
    qcFuture,
    qcAob,
    qcThreats,
    qcLeads,
    qcPersonalInfo,
    ...interactionFields
  } = parsed.data;
  const settingFollowUp = followUpAt !== undefined && !!parsed.data.personId;

  const qcFields = { qcPresent, qcPast, qcFuture, qcAob, qcThreats, qcLeads, qcPersonalInfo };
  // notes is a server-computed concatenation of the 7 sections for a
  // Qualification Call — the single source of truth moved off the client so
  // every existing consumer of notes (search, Extract Intelligence, Reflect
  // on Call) keeps working unchanged without trusting the frontend to have
  // assembled it correctly.
  const notes = interactionFields.type === "QUALIFICATION_CALL" ? buildQualificationCallNotes(qcFields) : rawNotes;

  const [interaction] = await prisma.$transaction([
    prisma.interaction.create({
      data: { ...interactionFields, notes, ...qcFields, createdById: req.userId },
    }),
    ...(settingFollowUp
      ? [prisma.person.update({ where: { id: parsed.data.personId! }, data: { followUpAt, followUpNote } })]
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
    include: { person: { include: { skills: true } }, targetContact: true, job: true, company: true },
  });
  if (!interaction) return res.status(404).json({ error: "Interaction not found" });
  if (!interaction.notes?.trim()) {
    return res.status(400).json({ error: "This interaction has no notes to extract from" });
  }

  const contact = contactNameAndType(interaction);
  let extracted;
  try {
    extracted = await extractIntelligence({
      personName: contact.name,
      personType: contact.personType,
      companyName: interaction.company?.name,
      jobTitle: interaction.job?.title,
      notes: interaction.notes,
    });
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Extraction failed" });
  }

  // Candidate skills mentioned in the notes but not yet tagged on the
  // Person — same fuzzy/synonym matching as CV parsing, not the LLM.
  // Meaningless for a Client Contact/Target Contact (no skills to tag), so
  // left empty there.
  let suggestedSkills: { id: string; name: string }[] = [];
  if (interaction.person?.personType === "CANDIDATE") {
    const knownSkills = await prisma.skill.findMany();
    const { confirmed, suggested } = guessSkills(interaction.notes, knownSkills.map((s) => s.name));
    const matchedNames = new Set([...confirmed, ...suggested]);
    const existingSkillIds = new Set(interaction.person.skills.map((s) => s.skillId));
    suggestedSkills = knownSkills
      .filter((s) => matchedNames.has(s.name) && !existingSkillIds.has(s.id))
      .map((s) => ({ id: s.id, name: s.name }));
  }

  const intelligence = await prisma.interactionIntelligence.upsert({
    where: { interactionId: interaction.id },
    update: { ...extracted, suggestedSkills, model: CLAUDE_MODEL } as any,
    create: { interactionId: interaction.id, ...extracted, suggestedSkills, model: CLAUDE_MODEL } as any,
  });

  res.json(intelligence);
});

interactionsRouter.get("/:id/intelligence", async (req, res) => {
  const intelligence = await prisma.interactionIntelligence.findUnique({
    where: { interactionId: req.params.id },
  });
  res.json(intelligence);
});

// Drafts all 7 Qualification Call sections from the attached transcript via
// the Anthropic API — never writes to the database (same idiom as CV
// parsing/Extract Intelligence's suggestions). The frontend shows this
// alongside whatever's already in each section and the user decides what to
// keep/edit/combine before an explicit PATCH /:id actually saves anything.
interactionsRouter.post("/:id/extract-qualification-sections", async (req, res) => {
  const interaction = await prisma.interaction.findUnique({
    where: { id: req.params.id },
    include: { person: true, targetContact: true },
  });
  if (!interaction) return res.status(404).json({ error: "Interaction not found" });
  if (interaction.type !== "QUALIFICATION_CALL") {
    return res.status(400).json({ error: "Only Qualification Call interactions have sections to draft" });
  }
  if (!interaction.transcript?.trim()) {
    return res.status(400).json({ error: "This interaction has no transcript to extract from" });
  }

  const contact = contactNameAndType(interaction);
  try {
    const drafted = await extractQualificationSections({
      personName: contact.name,
      transcript: interaction.transcript,
      existingSections: {
        qcPresent: interaction.qcPresent,
        qcPast: interaction.qcPast,
        qcFuture: interaction.qcFuture,
        qcAob: interaction.qcAob,
        qcThreats: interaction.qcThreats,
        qcLeads: interaction.qcLeads,
        qcPersonalInfo: interaction.qcPersonalInfo,
      },
    });
    res.json(drafted);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Extraction failed" });
  }
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
    include: { person: true, targetContact: true },
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
      personName: contactNameAndType(interaction).name,
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

const interactionUpdateSchema = z.object({
  notes: nullableString,
  transcript: nullableString,
  qcPresent: nullableString,
  qcPast: nullableString,
  qcFuture: nullableString,
  qcAob: nullableString,
  qcThreats: nullableString,
  qcLeads: nullableString,
  qcPersonalInfo: nullableString,
});

// The one deliberate, tracked exception to "append-only": lets a typo or
// missing detail be fixed after the fact instead of only ever being
// addable via a new follow-up interaction, while still leaving a visible
// trace (editedAt/editedById, shown as an "(edited)" marker) rather than
// silently rewriting history with no record it happened. Only the
// human-authored content fields are editable here — type/personId/
// company/job links are not: changing those means "this was logged
// against the wrong record", which isn't what this endpoint is for.
// A blank ("") value clears that field (nullableString); an omitted key
// leaves it unchanged.
interactionsRouter.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const parsed = interactionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.interaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Interaction not found" });

  const { notes, transcript, qcPresent, qcPast, qcFuture, qcAob, qcThreats, qcLeads, qcPersonalInfo } = parsed.data;

  // For a Qualification Call, notes stays a server-computed concatenation
  // of the 7 sections (see POST /) — recomputed here from whichever
  // sections this request changed, falling back to the existing value for
  // any section left untouched, so a PATCH that only edits e.g. the
  // transcript still leaves notes internally consistent.
  const resolvedNotes =
    existing.type === "QUALIFICATION_CALL"
      ? buildQualificationCallNotes({
          qcPresent: qcPresent !== undefined ? qcPresent : existing.qcPresent,
          qcPast: qcPast !== undefined ? qcPast : existing.qcPast,
          qcFuture: qcFuture !== undefined ? qcFuture : existing.qcFuture,
          qcAob: qcAob !== undefined ? qcAob : existing.qcAob,
          qcThreats: qcThreats !== undefined ? qcThreats : existing.qcThreats,
          qcLeads: qcLeads !== undefined ? qcLeads : existing.qcLeads,
          qcPersonalInfo: qcPersonalInfo !== undefined ? qcPersonalInfo : existing.qcPersonalInfo,
        })
      : notes;

  const interaction = await prisma.interaction.update({
    where: { id: req.params.id },
    data: {
      notes: resolvedNotes,
      transcript,
      qcPresent,
      qcPast,
      qcFuture,
      qcAob,
      qcThreats,
      qcLeads,
      qcPersonalInfo,
      editedAt: new Date(),
      editedById: req.userId,
    },
    include: { editedBy: { select: { name: true } } },
  });

  res.json(interaction);
});
