import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { recordProspectsForClosedJob } from "../lib/candidateProspects";
import { resolveCompanyIdByName, findFuzzyCompanyMatch, findExistingCompanyId } from "../lib/companyResolution";
import { findJobDuplicates } from "../lib/duplicateDetection";
import { extractJobFields } from "../lib/jobExtraction";
import { guessSkills } from "../lib/cvExtraction";
import { optionalString } from "../lib/zodHelpers";

const CLOSED_JOB_STAGES = new Set(["PLACED", "REJECTED"]);

export const jobsRouter = Router();

const jobSchema = z.object({
  title: z.string().min(1),
  companyId: z.string().uuid().optional(),
  // Free-text alternative to companyId — e.g. from the LinkedIn-paste flow,
  // where extraction only ever produces a company name, not an existing
  // record's ID. Resolved server-side to an existing Company or a newly
  // created one (see toPrismaData); if both are given, companyName wins,
  // same precedent as Person.currentEmployerName/currentEmployerId.
  companyName: optionalString,
  // The recruiter's own judgement of close-likelihood/data quality — never
  // calculated, and required so nothing ends up unrated by accident.
  qualityRating: z.enum(["A", "B", "C"]),
  level: z.string().optional(),
  location: z.string().optional(),
  workPreference: z.enum(["REMOTE", "HYBRID", "ONSITE"]).optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  rateMin: z.number().optional(),
  rateMax: z.number().optional(),
  owningContactId: z.string().uuid().optional(),
  essentialSkillIds: z.array(z.string().uuid()).optional(),
  idealSkillIds: z.array(z.string().uuid()).optional(),
  roleTypeIds: z.array(z.string().uuid()).optional(),
  jobSpecText: z.string().optional(),
});

const JOB_STAGES = [
  "POTENTIAL_LEAD",
  "QUALIFIED",
  "SPEC_TAKEN",
  "CV_SOURCING",
  "CVS_SENT",
  "INTERVIEWING",
  "OFFERED",
  "PLACED",
  "REJECTED",
] as const;

// Prisma's `set` (replace-the-whole-relation) only exists on an update —
// it's what the toggle-style skill/role-type pickers on an existing Job
// rely on (unchecking one must actually remove it, not just leave it
// unconnected), but it's an invalid argument on `create`, where there's no
// existing relation to replace and `connect` is the correct verb instead.
// This never surfaced before since nothing previously called POST /
// (create) with skill/role-type IDs attached — JobCreateForm doesn't — but
// the LinkedIn-paste flow's skill suggestions do.
async function toPrismaData(input: z.infer<typeof jobSchema>, mode: "create" | "update") {
  const { essentialSkillIds, idealSkillIds, roleTypeIds, companyName, ...rest } = input;
  const resolvedCompanyId = companyName ? await resolveCompanyIdByName(prisma, companyName) : undefined;
  const relationVerb = mode === "create" ? "connect" : "set";
  return {
    ...rest,
    ...(resolvedCompanyId ? { companyId: resolvedCompanyId } : {}),
    ...(essentialSkillIds ? { essentialSkills: { [relationVerb]: essentialSkillIds.map((id) => ({ id })) } } : {}),
    ...(idealSkillIds ? { idealSkills: { [relationVerb]: idealSkillIds.map((id) => ({ id })) } } : {}),
    ...(roleTypeIds ? { roleTypes: { [relationVerb]: roleTypeIds.map((id) => ({ id })) } } : {}),
  };
}

const jobParseSchema = z.object({ text: z.string().min(1) });

// Pure extraction — nothing is saved here, same idiom as POST /api/cv/parse.
// The frontend shows the drafted fields (plus jobSpecText, the raw pasted
// text passed straight through unchanged) in an editable review form;
// only POST / below actually persists anything.
jobsRouter.post("/parse", async (req: AuthenticatedRequest, res) => {
  const parsed = jobParseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { text } = parsed.data;

  let extracted;
  try {
    extracted = await extractJobFields(text);
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : "Extraction failed" });
  }

  // A fuzzy (typo-level) near-miss against an existing Company — not
  // confident enough for resolveCompanyIdByName to auto-link when this
  // gets saved, so it's surfaced here for the user to confirm or dismiss,
  // same pattern as CV parsing's employer suggestion.
  const employerMatchSuggestion = await findFuzzyCompanyMatch(prisma, extracted.companyName);

  // Candidate skills mentioned in the post, matched with the same
  // deterministic fuzzy/synonym matcher CV parsing uses — never the LLM,
  // and never auto-applied; shown as confirmed/suggested checkboxes for
  // the user to approve, same as everywhere else this matcher is used.
  const knownSkills = await prisma.skill.findMany();
  const { confirmed, suggested } = guessSkills(text, knownSkills.map((s) => s.name));
  const confirmedSkills = knownSkills.filter((s) => confirmed.includes(s.name));
  const suggestedSkills = knownSkills.filter((s) => suggested.includes(s.name));

  res.json({
    extracted: {
      ...extracted,
      jobSpecText: text,
      employerMatchSuggestion,
      skills: confirmedSkills.map((s) => ({ id: s.id, name: s.name })),
      suggestedSkills: suggestedSkills.map((s) => ({ id: s.id, name: s.name })),
    },
  });
});

const jobDuplicateCheckSchema = z.object({
  companyName: z.string().min(1),
  title: z.string().min(1),
  excludeJobId: z.string().uuid().optional(),
});

// Pre-flight check the review UI calls before confirming a new Job, same
// pattern as POST /api/people/check-duplicates. Takes a free-text company
// name (not an id) and only looks the company up read-only — a brand-new
// company can't already have a job, so nothing is created here just to
// perform this check.
jobsRouter.post("/check-duplicates", async (req, res) => {
  const parsed = jobDuplicateCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { companyName, title, excludeJobId } = parsed.data;
  const companyId = await findExistingCompanyId(prisma, companyName);
  if (!companyId) return res.json({ matches: [] });

  const matches = await findJobDuplicates(prisma, { companyId, title }, excludeJobId);
  res.json({ matches });
});

jobsRouter.get("/", async (req, res) => {
  const { q, stage, companyId, includeArchived, qualityRating, includeClosed } = req.query;

  // Combinable multi-select: ?qualityRating=A&qualityRating=B, or a single value.
  const ratings = qualityRating
    ? (Array.isArray(qualityRating) ? qualityRating : [qualityRating]).map(String)
    : [];

  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        includeArchived === "true" ? {} : { archivedAt: null },
        q
          ? {
              OR: [
                { title: { contains: String(q), mode: "insensitive" } },
                { company: { name: { contains: String(q), mode: "insensitive" } } },
              ],
            }
          : {},
        // An explicit stage pick always wins; otherwise Placed/Rejected jobs
        // are hidden by default so the day-to-day list stays to what still
        // needs attention, and shown only when the caller asks for them.
        stage ? { stage: stage as any } : includeClosed === "true" ? {} : { stage: { notIn: Array.from(CLOSED_JOB_STAGES) as any } },
        companyId ? { companyId: String(companyId) } : {},
        ratings.length ? { qualityRating: { in: ratings as any } } : {},
      ],
    },
    include: { company: true, essentialSkills: true, idealSkills: true, roleTypes: true, candidates: true },
    orderBy: { updatedAt: "desc" },
  });

  res.json(jobs);
});

jobsRouter.get("/:id", async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      // terms included so the placement form can default Fee % from the
      // company's own Fee Structure percentage.
      company: { include: { terms: true } },
      essentialSkills: true,
      idealSkills: true,
      roleTypes: true,
      owningContact: true,
      candidates: {
        include: {
          candidate: true,
          stageChanges: { orderBy: { createdAt: "desc" } },
          scheduledEvents: { orderBy: { scheduledAt: "asc" } },
        },
      },
      documents: { include: { versions: true } },
      interactions: { orderBy: { occurredAt: "desc" }, include: { person: true } },
      stageChanges: { orderBy: { createdAt: "desc" } },
      placement: { include: { candidate: true } },
      tags: { include: { tag: true } },
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// "Previously shortlisted, may fit" suggestions — candidates who reached
// Shortlisted-or-beyond (but weren't placed) on some other job, matched
// against this job's essential/ideal skills, level ("seniority"), and
// location. A suggestion to review and act on, never auto-added to this
// job's pipeline.
jobsRouter.get("/:id/suggested-candidates", async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      essentialSkills: true,
      idealSkills: true,
      candidates: { select: { candidateId: true } },
    },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });

  const jobSkillIds = new Set([...job.essentialSkills, ...job.idealSkills].map((s) => s.id));
  const existingCandidateIds = job.candidates.map((c) => c.candidateId);

  const prospects = await prisma.candidateProspect.findMany({
    where: {
      candidateId: { notIn: existingCandidateIds },
      candidate: { archivedAt: null, deletedAt: null },
    },
    include: {
      candidate: { include: { skills: { include: { skill: true } } } },
      sourceJob: { select: { id: true, title: true, company: { select: { id: true, name: true } } } },
    },
    // One row per candidate — their most recent prospect entry, if they were
    // shortlisted on more than one past job.
    distinct: ["candidateId"],
    orderBy: { createdAt: "desc" },
  });

  const suggestions = prospects
    .map((p) => {
      const matchingSkills = p.candidate.skills.map((s) => s.skill).filter((s) => jobSkillIds.has(s.id));
      const locationMatch = !!(
        job.location &&
        p.candidate.location &&
        job.location.trim().toLowerCase() === p.candidate.location.trim().toLowerCase()
      );
      const seniorityMatch = !!(
        job.level &&
        p.candidate.seniority &&
        job.level.trim().toLowerCase() === p.candidate.seniority.trim().toLowerCase()
      );
      return {
        candidate: {
          id: p.candidate.id,
          firstName: p.candidate.firstName,
          surname: p.candidate.surname,
          seniority: p.candidate.seniority,
          location: p.candidate.location,
        },
        matchingSkills: matchingSkills.map((s) => ({ id: s.id, name: s.name })),
        locationMatch,
        seniorityMatch,
        reachedStage: p.reachedStage,
        sourceJob: { id: p.sourceJob.id, title: p.sourceJob.title, companyName: p.sourceJob.company.name },
      };
    })
    .filter((s) => s.matchingSkills.length > 0 || s.locationMatch || s.seniorityMatch)
    .sort((a, b) => b.matchingSkills.length - a.matchingSkills.length);

  res.json(suggestions);
});

jobsRouter.post("/", async (req, res) => {
  const parsed = jobSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = await toPrismaData(parsed.data, "create");
  if (!data.companyId) return res.status(400).json({ error: "A company is required" });

  const job = await prisma.job.create({ data: data as any });
  res.status(201).json(job);
});

jobsRouter.patch("/:id", async (req, res) => {
  const parsed = jobSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: (await toPrismaData(parsed.data as any, "update")) as any,
  });
  res.json(job);
});

// Archive: hidden from default views but fully reversible — jobs anchor
// pipeline/placement/interaction history, so there is no hard delete.
jobsRouter.post("/:id/archive", async (req, res) => {
  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { archivedAt: new Date() },
  });
  res.json(job);
});

jobsRouter.post("/:id/unarchive", async (req, res) => {
  const job = await prisma.job.update({
    where: { id: req.params.id },
    data: { archivedAt: null },
  });
  res.json(job);
});

const stageChangeSchema = z.object({
  stage: z.enum(JOB_STAGES),
  note: z.string().optional(),
});

// Job-level stage change — always logged as an immutable, timestamped StageChange row.
jobsRouter.post("/:id/stage", async (req: AuthenticatedRequest, res) => {
  const parsed = stageChangeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const current = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!current) return res.status(404).json({ error: "Job not found" });

  const job = await prisma.$transaction(async (tx) => {
    const updated = await tx.job.update({ where: { id: req.params.id }, data: { stage: parsed.data.stage } });
    await tx.stageChange.create({
      data: {
        jobId: req.params.id,
        fromStage: current.stage,
        toStage: parsed.data.stage,
        note: parsed.data.note,
        changedById: req.userId,
      },
    });

    if (CLOSED_JOB_STAGES.has(parsed.data.stage)) {
      const placement = await tx.placement.findUnique({ where: { jobId: req.params.id } });
      await recordProspectsForClosedJob(tx, req.params.id, current.companyId, placement?.candidateId);
    }

    return updated;
  });

  res.json(job);
});
