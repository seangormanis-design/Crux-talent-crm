import { Router } from "express";
import { prisma } from "../lib/prisma";

export const searchRouter = Router();

// Global search: People, Companies, and Jobs simultaneously, matching name,
// email, phone, company name, job title, and notes/interaction text.
// Results are grouped by type only (not a separate documents/interactions
// group) — a note match surfaces the Person/Company it belongs to.
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  if (!q) return res.json({ people: [], companies: [], jobs: [] });

  const contains = { contains: q, mode: "insensitive" as const };

  const [people, companies, jobs] = await Promise.all([
    prisma.person.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        OR: [
          { name: contains },
          { email: contains },
          { phone: contains },
          { motivationsText: contains },
          { relationshipNotes: contains },
          { jobTitle: contains },
          { currentTitle: contains },
          { company: { name: contains } },
          { currentEmployer: { name: contains } },
          { interactions: { some: { notes: contains } } },
        ],
      },
      include: { company: true, currentEmployer: true },
      take: limit,
    }),
    prisma.company.findMany({
      where: {
        archivedAt: null,
        OR: [
          { name: contains },
          { notes: contains },
          { contacts: { some: { name: contains } } },
          { interactions: { some: { notes: contains } } },
        ],
      },
      take: limit,
    }),
    prisma.job.findMany({
      where: {
        archivedAt: null,
        OR: [{ title: contains }, { company: { name: contains } }],
      },
      include: { company: true },
      take: limit,
    }),
  ]);

  res.json({ people, companies, jobs });
});
