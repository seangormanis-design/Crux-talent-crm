import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import { authRouter } from "./routes/auth";
import { companiesRouter } from "./routes/companies";
import { peopleRouter } from "./routes/people";
import { skillsRouter } from "./routes/skills";
import { roleTypesRouter } from "./routes/roleTypes";
import { jobsRouter } from "./routes/jobs";
import { pipelineRouter } from "./routes/pipeline";
import { documentsRouter } from "./routes/documents";
import { interactionsRouter } from "./routes/interactions";
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
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);

  // Everything below requires a valid session.
  app.use("/api/companies", requireAuth, companiesRouter);
  app.use("/api/people", requireAuth, peopleRouter);
  app.use("/api/skills", requireAuth, skillsRouter);
  app.use("/api/role-types", requireAuth, roleTypesRouter);
  app.use("/api/jobs", requireAuth, jobsRouter);
  app.use("/api/pipeline", requireAuth, pipelineRouter);
  app.use("/api/documents", requireAuth, documentsRouter);
  app.use("/api/interactions", requireAuth, interactionsRouter);
  app.use("/api/placements", requireAuth, placementsRouter);
  app.use("/api/tags", requireAuth, tagsRouter);
  app.use("/api/search", requireAuth, searchRouter);
  app.use("/api/dashboard", requireAuth, dashboardRouter);
  app.use("/api/import", requireAuth, importRouter);
  app.use("/api/cv", requireAuth, cvRouter);

  if (process.env.STORAGE_DRIVER !== "s3") {
    app.use("/files", requireAuth, express.static(path.resolve(process.env.STORAGE_LOCAL_PATH ?? "./storage")));
  }

  return app;
}
