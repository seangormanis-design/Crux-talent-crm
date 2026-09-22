// Must be the very first import: patches Express 4's router methods so a
// rejected promise from an async route handler is forwarded to the error
// middleware below, instead of silently hanging the request forever (see
// the global error handler's comment for why this matters).
import "express-async-errors";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import { authRouter } from "./routes/auth";
import { companiesRouter } from "./routes/companies";
import { peopleRouter } from "./routes/people";
import { skillsRouter } from "./routes/skills";
import { roleTypesRouter } from "./routes/roleTypes";
import { jobsRouter } from "./routes/jobs";
import { opportunitiesRouter } from "./routes/opportunities";
import { targetContactsRouter } from "./routes/targetContacts";
import { pipelineRouter } from "./routes/pipeline";
import { documentsRouter } from "./routes/documents";
import { interactionsRouter } from "./routes/interactions";
import { scheduledEventsRouter } from "./routes/scheduledEvents";
import { callProfileRouter } from "./routes/callProfile";
import { placementsRouter } from "./routes/placements";
import { tagsRouter } from "./routes/tags";
import { searchRouter } from "./routes/search";
import { dashboardRouter } from "./routes/dashboard";
import { importRouter } from "./routes/import";
import { cvRouter } from "./routes/cv";
import { requireAuth } from "./middleware/requireAuth";

export function buildApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
  // express.json()'s default 100kb limit is easily exceeded by a pasted call
  // transcript (a real Teams transcript with per-line speaker/timestamp
  // formatting routinely runs to several hundred KB) — a body over that
  // limit gets rejected before the route handler ever runs, and with no
  // matching try/catch on the frontend call site, that failure was
  // completely invisible to the user.
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  // Minimal request logging — this app had none at all, which meant a
  // hung/failed request was invisible in `docker logs` no matter what
  // caused it. Logs on completion (not just entry) so the duration itself
  // is diagnostic: a request that never logs its completion line is one
  // that's still hanging.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);

  // Everything below requires a valid session.
  app.use("/api/companies", requireAuth, companiesRouter);
  app.use("/api/people", requireAuth, peopleRouter);
  app.use("/api/skills", requireAuth, skillsRouter);
  app.use("/api/role-types", requireAuth, roleTypesRouter);
  app.use("/api/jobs", requireAuth, jobsRouter);
  app.use("/api/opportunities", requireAuth, opportunitiesRouter);
  app.use("/api/target-contacts", requireAuth, targetContactsRouter);
  app.use("/api/pipeline", requireAuth, pipelineRouter);
  app.use("/api/documents", requireAuth, documentsRouter);
  app.use("/api/interactions", requireAuth, interactionsRouter);
  app.use("/api/scheduled-events", requireAuth, scheduledEventsRouter);
  app.use("/api/call-profile", requireAuth, callProfileRouter);
  app.use("/api/placements", requireAuth, placementsRouter);
  app.use("/api/tags", requireAuth, tagsRouter);
  app.use("/api/search", requireAuth, searchRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/import", requireAuth, importRouter);
  app.use("/api/cv", requireAuth, cvRouter);

  if (process.env.STORAGE_DRIVER !== "s3") {
    app.use("/files", requireAuth, express.static(path.resolve(process.env.STORAGE_LOCAL_PATH ?? "./storage")));
  }

  // Catch-all: with express-async-errors patched in above, any error thrown
  // or rejected anywhere in a route handler (most of which have no try/catch
  // of their own around their Prisma/storage calls) lands here instead of
  // leaving the request hanging with no response ever sent — which is what
  // "nothing happens, no error" looks like from the browser. Logged with the
  // request-logging middleware's completion line still firing right after,
  // so a failure is now always visible in both the response and the logs.
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error(`Unhandled error on ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) return;
    res.status(500).json({ error: err instanceof Error ? err.message : "Something went wrong. Please try again." });
  });

  return app;
}
