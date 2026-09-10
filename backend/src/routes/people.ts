import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";

export const peopleRouter = Router();

const personSchema = z.object({
  personType: z.enum(["CANDIDATE", "CLIENT_CONTACT"]),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),

  // Candidate fields
  currentEmployerId: z.string().uuid().optional(),
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

  linkedPersonId: z.string().uuid().nullable().optional(),
});

function toPrismaData(input: z.infer<typeof personSchema>) {
  const { skillIds, ...rest } = input;
  return {
    ...rest,
    ...(skillIds
      ? { skills: { create: skillIds.map((skillId) => ({ skillId })) } }
      : {}),
  };
}

peopleRouter.get("/", async (req, res) => {
  const { q, personType, skill } = req.query;

  const people = await prisma.person.findMany({
    where: {
      deletedAt: null,
      AND: [
        personType ? { personType: personType as any } : {},
        q
          ? {
              OR: [
                { name: { contains: String(q), mode: "insensitive" } },
                { email: { contains: String(q), mode: "insensitive" } },
                { motivationsText: { contains: String(q), mode: "insensitive" } },
              ],
            }
          : {},
        skill ? { skills: { some: { skill: { name: String(skill) } } } } : {},
      ],
    },
    include: { skills: { include: { skill: true } }, company: true, currentEmployer: true },
    orderBy: { name: "asc" },
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

  const person = await prisma.person.create({ data: toPrismaData(parsed.data) as any });
  res.status(201).json(person);
});

peopleRouter.patch("/:id", async (req, res) => {
  const parsed = personSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { skillIds, ...rest } = parsed.data;

  const person = await prisma.$transaction(async (tx) => {
    if (skillIds) {
      await tx.personSkill.deleteMany({ where: { personId: req.params.id } });
      await tx.personSkill.createMany({
        data: skillIds.map((skillId) => ({ personId: req.params.id, skillId })),
      });
    }
    return tx.person.update({ where: { id: req.params.id }, data: rest });
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

// GDPR soft-delete + anonymize: never hard-deletes interaction/pipeline history,
// only scrubs personal fields so that history stays queryable.
peopleRouter.post("/:id/anonymize", async (req, res) => {
  const person = await prisma.person.update({
    where: { id: req.params.id },
    data: {
      name: "Anonymized",
      email: null,
      phone: null,
      motivationsText: null,
      relationshipNotes: null,
      isAnonymized: true,
      deletedAt: new Date(),
    },
  });
  res.json(person);
});
