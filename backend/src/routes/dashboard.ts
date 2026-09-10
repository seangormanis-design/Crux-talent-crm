import { Router } from "express";
import { prisma } from "../lib/prisma";

export const dashboardRouter = Router();

const STALE_JOB_DAYS = 14;
const DOC_EXPIRY_WARNING_DAYS = 30;

// Pipeline/funnel view + activity feed, equally weighted per spec section 5.
dashboardRouter.get("/", async (_req, res) => {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_JOB_DAYS * 24 * 60 * 60 * 1000);
  const docExpiryThreshold = new Date(now.getTime() + DOC_EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);

  const [jobsByStage, staleJobs, expiringDocuments, recentInteractions, candidatesAwaitingResponse, followUps] =
    await Promise.all([
      prisma.job.groupBy({ by: ["stage"], where: { archivedAt: null }, _count: { _all: true } }),
      prisma.job.findMany({
        where: { updatedAt: { lt: staleThreshold }, stage: { notIn: ["PLACED", "REJECTED"] }, archivedAt: null },
        include: { company: true },
        orderBy: { updatedAt: "asc" },
        take: 20,
      }),
      prisma.document.findMany({
        where: { expiresAt: { lte: docExpiryThreshold, gte: now } },
        include: { person: true, company: true, versions: { orderBy: { versionNo: "desc" }, take: 1 } },
        orderBy: { expiresAt: "asc" },
      }),
      prisma.interaction.findMany({
        orderBy: { occurredAt: "desc" },
        take: 20,
        include: { person: true, job: true },
      }),
      prisma.jobCandidate.findMany({
        where: { stage: "CV_SENT", job: { archivedAt: null }, candidate: { archivedAt: null } },
        include: { candidate: true, job: { include: { company: true } } },
        orderBy: { updatedAt: "asc" },
        take: 20,
      }),
      prisma.person.findMany({
        where: { followUpAt: { not: null }, deletedAt: null, archivedAt: null },
        orderBy: { followUpAt: "asc" },
        take: 50,
      }),
    ]);

  res.json({
    pipeline: jobsByStage,
    activityFeed: {
      staleJobs,
      expiringDocuments,
      recentInteractions,
      candidatesAwaitingResponse,
      followUps,
    },
  });
});
