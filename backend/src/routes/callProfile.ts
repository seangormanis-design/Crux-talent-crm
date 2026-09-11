import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest } from "../middleware/requireAuth";
import { refreshCallProfileIfDue } from "../lib/callReflection";

export const callProfileRouter = Router();

callProfileRouter.get("/", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.json(null);
  const profile = await prisma.userCallProfile.findUnique({ where: { userId: req.userId } });
  res.json(profile);
});

// Manual "Refresh now" — bypasses the ~weekly cadence gate (still a no-op if
// there's no new feedback since the last update, since there'd be nothing to
// summarise).
callProfileRouter.post("/refresh", async (req: AuthenticatedRequest, res) => {
  if (!req.userId) return res.status(401).json({ error: "Not authenticated" });

  const refreshed = await refreshCallProfileIfDue(prisma, req.userId, { force: true });
  if (!refreshed) {
    return res.status(400).json({ error: "No new feedback since your last profile update" });
  }

  const profile = await prisma.userCallProfile.findUnique({ where: { userId: req.userId } });
  res.json(profile);
});
