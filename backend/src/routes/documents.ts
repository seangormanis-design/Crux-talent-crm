import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { storage } from "../storage";

export const documentsRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const DOCUMENT_TYPES = [
  "CANDIDATE_CV",
  "CRUX_FORMATTED_CV",
  "TERMS_OF_BUSINESS",
  "COMPANY_DOC",
  "JOB_SPEC",
  "CONTRACTOR_CORP_DOC",
  "OTHER",
] as const;

const createDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  personId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  expiresAt: z.coerce.date().optional(),
  note: z.string().optional(),
});

documentsRouter.get("/", async (req, res) => {
  const { personId, companyId, jobId, expiringBefore } = req.query;

  const documents = await prisma.document.findMany({
    where: {
      personId: personId ? String(personId) : undefined,
      companyId: companyId ? String(companyId) : undefined,
      jobId: jobId ? String(jobId) : undefined,
      expiresAt: expiringBefore ? { lte: new Date(String(expiringBefore)) } : undefined,
    },
    include: { versions: { orderBy: { versionNo: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json(documents);
});

documentsRouter.get("/:id", async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { versionNo: "desc" } } },
  });
  if (!document) return res.status(404).json({ error: "Document not found" });
  res.json(document);
});

// Creates a new logical document AND its first version, in one call, from an
// uploaded file.
documentsRouter.post("/", upload.single("file"), async (req, res) => {
  const parsed = createDocumentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!req.file) return res.status(400).json({ error: "A file is required" });

  const { note, ...documentFields } = parsed.data;
  const stored = await storage.save(req.file.buffer, req.file.originalname);

  const document = await prisma.document.create({
    data: {
      ...documentFields,
      versions: {
        create: {
          versionNo: 1,
          fileName: req.file.originalname,
          storageKey: stored.storageKey,
          mimeType: req.file.mimetype,
          sizeBytes: stored.sizeBytes,
          note,
        },
      },
    },
    include: { versions: true },
  });

  res.status(201).json(document);
});

// Every re-upload creates a new version — the previous version is never
// overwritten or deleted, so full history stays browsable.
documentsRouter.post("/:id/versions", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A file is required" });

  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { versions: true },
  });
  if (!document) return res.status(404).json({ error: "Document not found" });

  const stored = await storage.save(req.file.buffer, req.file.originalname);
  const nextVersionNo = Math.max(0, ...document.versions.map((v) => v.versionNo)) + 1;

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNo: nextVersionNo,
      fileName: req.file.originalname,
      storageKey: stored.storageKey,
      mimeType: req.file.mimetype,
      sizeBytes: stored.sizeBytes,
      note: req.body.note,
    },
  });

  res.status(201).json(version);
});

documentsRouter.get("/versions/:versionId/download", async (req, res) => {
  const version = await prisma.documentVersion.findUnique({ where: { id: req.params.versionId } });
  if (!version) return res.status(404).json({ error: "Version not found" });

  const buffer = await storage.read(version.storageKey);
  res.setHeader("Content-Disposition", `attachment; filename="${version.fileName}"`);
  res.setHeader("Content-Type", version.mimeType ?? "application/octet-stream");
  res.send(buffer);
});
