import { Router } from "express";
import { prisma } from "../lib/prisma";

export const searchRouter = Router();

// Phase 1 manual search: full-text-ish search across People, Companies, Jobs,
// Documents and Interaction notes. Phase 2 will layer a scoring engine on top
// of the same skills/motivations tags rather than replacing this.
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ people: [], companies: [], jobs: [], documents: [], interactions: [] });

  const contains = { contains: q, mode: "insensitive" as const };

  const [people, companies, jobs, documents, interactions] = await Promise.all([
    prisma.person.findMany({
      where: { deletedAt: null, OR: [{ name: contains }, { email: contains }, { motivationsText: contains }] },
      take: 20,
    }),
    prisma.company.findMany({
      where: { OR: [{ name: contains }, { notes: contains }] },
      take: 20,
    }),
    prisma.job.findMany({
      where: { title: contains },
      include: { company: true },
      take: 20,
    }),
    prisma.document.findMany({
      where: { versions: { some: { fileName: contains } } },
      include: { versions: true },
      take: 20,
    }),
    prisma.interaction.findMany({
      where: { notes: contains },
      include: { person: true },
      take: 20,
    }),
  ]);

  res.json({ people, companies, jobs, documents, interactions });
});
