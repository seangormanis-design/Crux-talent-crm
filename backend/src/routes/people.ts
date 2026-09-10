import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { nullableDate, optionalEmail, optionalString, optionalUrl } from "../lib/zodHelpers";
import { findPersonDuplicates } from "../lib/duplicateDetection";
import { resolveCompanyIdByName } from "../lib/companyResolution";

export const peopleRouter = Router();

const duplicateCheckSchema = z.object({
  firstName: z.string().optional(),
  surname: z.string().optional(),
  workEmail: z.string().optional(),
  personalEmail: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  excludePersonId: z.string().uuid().optional(),
});

// Pre-flight check the frontend calls before confirming a new Person —
// manual create and CSV import both go through this same matching logic.
peopleRouter.post("/check-duplicates", async (req, res) => {
  const parsed = duplicateCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { excludePersonId, ...candidate } = parsed.data;
  const matches = await findPersonDuplicates(prisma, candidate, excludePersonId);
  res.json({ matches });
});

const personSchema = z.object({
  personType: z.enum(["CANDIDATE", "CLIENT_CONTACT"]),
  firstName: z.string().min(1),
  surname: optionalString,
  workEmail: optionalEmail,
  personalEmail: optionalEmail,
  phone: optionalString,
  linkedinUrl: optionalUrl,
  addressStreet: optionalString,
  addressCity: optionalString,
  addressPostcode: optionalString,

  // Candidate fields
  currentEmployerId: z.string().uuid().optional(),
  // Free-text alternative to currentEmployerId — e.g. from CV parsing,
  // where we only have a company name, not an existing record's ID.
  // Resolved server-side to an existing Company or a newly created one.
  currentEmployerName: optionalString,
  currentTitle: z.string().optional(),
  seniority: z.string().optional(),
  dayRate: z.number().optional(),
  salaryExpectation: z.number().optional(),
  location: z.string().optional(),
  workPreference: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  rightToWork: z.string().optional(),
  availability: z.string().optional(),
  motivationsText: z.string().optional(),
  skillIds: z.array(z.string().uuid()).optional(),

  // Client contact fields
  companyId: z.string().uuid().optional(),
  jobTitle: z.string().optional(),
  decisionRole: z.enum(["HIRING_MANAGER", "PRACTICE_LEAD", "DELIVERY_DIRECTOR", "HR", "OTHER"]).optional(),
  relationshipNotes: z.string().optional(),

  // Shared / GDPR
  source: z.enum(["LINKEDIN", "REFERRAL", "INBOUND", "SOURCED", "OTHER"]).optional(),
  gdprConsent: z.boolean().optional(),
  gdprConsentNote: z.string().optional(),
  lawfulBasisNote: z.string().optional(),
  retentionReviewAt: z.coerce.date().optional(),

  // Follow-up reminder
  followUpAt: nullableDate,
  followUpNote: optionalString,

  linkedPersonId: z.string().uuid().nullable().optional(),
});

async function toPrismaData(input: z.infer<typeof personSchema>) {
  const { skillIds, currentEmployerName, ...rest } = input;
  const resolvedEmployerId = currentEmployerName
    ? await resolveCompanyIdByName(prisma, currentEmployerName)
    : undefined;

  return {
    ...rest,
    ...(resolvedEmployerId ? { currentEmployerId: resolvedEmployerId } : {}),
    ...(skillIds
      ? { skills: { create: skillIds.map((skillId) => ({ skillId })) } }
      : {}),
  };
}

peopleRouter.get("/", async (req, res) => {
  const { q, personType, skillId, location, companyId, stage, includeArchived } = req.query;

  const people = await prisma.person.findMany({
    where: {
      deletedAt: null,
      AND: [
        includeArchived === "true" ? {} : { archivedAt: null },
        personType ? { personType: personType as any } : {},
        q
          ? {
              OR: [
                { firstName: { contains: String(q), mode: "insensitive" } },
                { surname: { contains: String(q), mode: "insensitive" } },
                { workEmail: { contains: String(q), mode: "insensitive" } },
                { personalEmail: { contains: String(q), mode: "insensitive" } },
                { motivationsText: { contains: String(q), mode: "insensitive" } },
                { company: { name: { contains: String(q), mode: "insensitive" } } },
                { currentEmployer: { name: { contains: String(q), mode: "insensitive" } } },
              ],
            }
          : {},
        skillId ? { skills: { some: { skillId: String(skillId) } } } : {},
        location ? { location: { contains: String(location), mode: "insensitive" } } : {},
        companyId ? { companyId: String(companyId) } : {},
        stage ? { jobApplications: { some: { stage: String(stage) as any } } } : {},
      ],
    },
    include: {
      skills: { include: { skill: true } },
      company: true,
      currentEmployer: true,
      interactions: { orderBy: { occurredAt: "desc" }, take: 1 },
      // "Current stage" for the list view: whichever pipeline entry this
      // candidate touched most recently, not every application they've ever had.
      jobApplications: { orderBy: { updatedAt: "desc" }, take: 1, include: { job: true } },
    },
    orderBy: [{ firstName: "asc" }, { surname: "asc" }],
  });

  res.json(people);
});

peopleRouter.get("/:id", async (req, res) => {
  const person = await prisma.person.findUnique({
    where: { id: req.params.id },
    include: {
      skills: { include: { skill: true } },
      documents: { include: { versions: true } },
      interactions: { orderBy: { occurredAt: "desc" } },
      jobApplications: { include: { job: true } },
      company: true,
      currentEmployer: true,
      linkedPerson: true,
      linkedFrom: true,
      tags: { include: { tag: true } },
    },
  });
  if (!person) return res.status(404).json({ error: "Person not found" });
  res.json(person);
});

peopleRouter.post("/", async (req, res) => {
  const parsed = personSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const person = await prisma.person.create({ data: (await toPrismaData(parsed.data)) as any });
  res.status(201).json(person);
});

peopleRouter.patch("/:id", async (req, res) => {
  const parsed = personSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { skillIds, currentEmployerName, ...rest } = parsed.data;
  const resolvedEmployerId = currentEmployerName
    ? await resolveCompanyIdByName(prisma, currentEmployerName)
    : undefined;

  const person = await prisma.$transaction(async (tx) => {
    if (skillIds) {
      await tx.personSkill.deleteMany({ where: { personId: req.params.id } });
      await tx.personSkill.createMany({
        data: skillIds.map((skillId) => ({ personId: req.params.id, skillId })),
      });
    }
    return tx.person.update({
      where: { id: req.params.id },
      data: { ...rest, ...(resolvedEmployerId ? { currentEmployerId: resolvedEmployerId } : {}) },
    });
  });

  res.json(person);
});

const MAX_PRIMARY_SKILLS = 5;

const setSkillsSchema = z.object({
  skills: z
    .array(z.object({ skillId: z.string().uuid(), isPrimary: z.boolean().optional() }))
    .max(200),
});

// Dedicated skill-assignment endpoint (separate from the generic PATCH's
// skillIds, which CV parsing/CSV import use for a plain replace-all): this
// one carries the Primary/Secondary flag, which lives on the assignment
// itself, not as a separate list. Full replace of this person's skill set.
peopleRouter.put("/:id/skills", async (req, res) => {
  const parsed = setSkillsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const primaryCount = parsed.data.skills.filter((s) => s.isPrimary).length;
  if (primaryCount > MAX_PRIMARY_SKILLS) {
    return res.status(400).json({ error: `You can mark at most ${MAX_PRIMARY_SKILLS} skills as Primary.` });
  }

  await prisma.$transaction([
    prisma.personSkill.deleteMany({ where: { personId: req.params.id } }),
    prisma.personSkill.createMany({
      data: parsed.data.skills.map((s) => ({
        personId: req.params.id,
        skillId: s.skillId,
        isPrimary: s.isPrimary ?? false,
      })),
    }),
  ]);

  const person = await prisma.person.findUnique({
    where: { id: req.params.id },
    include: { skills: { include: { skill: true } } },
  });
  res.json(person);
});

// Flip which linked record (candidate vs client contact) is primary, without
// losing history on either side of the relationship.
peopleRouter.post("/:id/set-primary-link", async (req, res) => {
  const person = await prisma.person.findUnique({ where: { id: req.params.id } });
  if (!person) return res.status(404).json({ error: "Person not found" });

  await prisma.$transaction(async (tx) => {
    await tx.person.update({ where: { id: req.params.id }, data: { isPrimaryLink: true } });
    if (person.linkedPersonId) {
      await tx.person.update({ where: { id: person.linkedPersonId }, data: { isPrimaryLink: false } });
    }
  });

  res.status(204).send();
});

// Archive: hidden from default views but fully reversible — distinct from
// the GDPR anonymize below, which permanently scrubs personal data.
peopleRouter.post("/:id/archive", async (req, res) => {
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() },
  });
  res.json(person);
});

peopleRouter.post("/:id/unarchive", async (req, res) => {
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: { archivedAt: null },
  });
  res.json(person);
});

// GDPR soft-delete + anonymize: never hard-deletes interaction/pipeline history,
// only scrubs personal fields so that history stays queryable.
peopleRouter.post("/:id/anonymize", async (req, res) => {
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: {
      firstName: "Anonymized",
      surname: null,
      workEmail: null,
      personalEmail: null,
      phone: null,
      motivationsText: null,
      relationshipNotes: null,
      isAnonymized: true,
      deletedAt: new Date(),
    },
  });
  res.json(person);
});
