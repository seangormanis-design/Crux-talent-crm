import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { findPersonDuplicates } from "../lib/duplicateDetection";
import { resolveCompanyIdByName } from "../lib/companyResolution";

export const importRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MAX_ROWS = 2000;

// Step 1: upload a CSV, get back its headers and every data row as raw
// strings — no interpretation yet. The frontend holds this in memory
// through the mapping and preview steps; only the final mapped rows come
// back to the server for the actual import.
importRouter.post("/parse", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A CSV file is required" });

  let records: string[][];
  try {
    records = parse(req.file.buffer, { skip_empty_lines: true, trim: true });
  } catch (err) {
    return res.status(400).json({ error: `Could not parse CSV: ${(err as Error).message}` });
  }

  if (!records.length) return res.status(400).json({ error: "CSV file is empty" });

  const [headers, ...rows] = records;
  if (rows.length > MAX_ROWS) {
    return res.status(400).json({ error: `This importer supports up to ${MAX_ROWS} rows (found ${rows.length}).` });
  }

  res.json({ headers, rows });
});

const personRowSchema = z.object({
  name: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  title: z.string().optional(),
  companyName: z.string().optional(),
  notes: z.string().optional(),
});

const importPeopleSchema = z.object({
  personType: z.enum(["CANDIDATE", "CLIENT_CONTACT"]),
  rows: z.array(personRowSchema).max(MAX_ROWS),
});

// Bulk person import — goes through the exact same findPersonDuplicates
// matcher manual entry uses (see routes/people.ts check-duplicates), so a
// row that matches an existing person is skipped rather than silently
// creating a duplicate.
importRouter.post("/people", async (req, res) => {
  const parsed = importPeopleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { personType, rows } = parsed.data;
  const created: unknown[] = [];
  const duplicates: { row: typeof rows[number]; matchedOn: string[]; existingPersonId: string; existingPersonName: string }[] = [];
  const errors: { row: typeof rows[number]; message: string }[] = [];

  for (const row of rows) {
    try {
      const matches = await findPersonDuplicates(prisma, {
        name: row.name,
        email: row.email,
        phone: row.phone,
        linkedinUrl: row.linkedinUrl,
      });

      if (matches.length) {
        const top = matches[0];
        duplicates.push({
          row,
          matchedOn: top.matchedOn,
          existingPersonId: top.person.id,
          existingPersonName: top.person.name,
        });
        continue;
      }

      const companyId = await resolveCompanyIdByName(prisma, row.companyName);

      const person = await prisma.person.create({
        data: {
          personType,
          name: row.name,
          email: row.email || undefined,
          phone: row.phone || undefined,
          linkedinUrl: row.linkedinUrl || undefined,
          ...(personType === "CANDIDATE"
            ? { currentTitle: row.title || undefined, currentEmployerId: companyId, motivationsText: row.notes || undefined }
            : { jobTitle: row.title || undefined, companyId, relationshipNotes: row.notes || undefined }),
        },
      });
      created.push(person);
    } catch (err) {
      errors.push({ row, message: (err as Error).message });
    }
  }

  res.json({ createdCount: created.length, duplicates, errors });
});

const companyRowSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  linkedinUrl: z.string().optional(),
  industry: z.string().optional(),
  hqLocation: z.string().optional(),
  notes: z.string().optional(),
});

const importCompaniesSchema = z.object({
  rows: z.array(companyRowSchema).max(MAX_ROWS),
});

// Company "duplicate" is simpler than Person's: an exact case-insensitive
// name match. Good enough for a company list, where name collisions are
// rare and meaningful (a genuine second company sharing a display name is
// rare enough that this doesn't need LinkedIn/phone-style matching).
importRouter.post("/companies", async (req, res) => {
  const parsed = importCompaniesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const created: unknown[] = [];
  const duplicates: { row: typeof parsed.data.rows[number]; existingCompanyId: string }[] = [];
  const errors: { row: typeof parsed.data.rows[number]; message: string }[] = [];

  for (const row of parsed.data.rows) {
    try {
      const existing = await prisma.company.findFirst({
        where: { name: { equals: row.name.trim(), mode: "insensitive" } },
      });
      if (existing) {
        duplicates.push({ row, existingCompanyId: existing.id });
        continue;
      }

      const company = await prisma.company.create({
        data: {
          name: row.name,
          website: row.website || undefined,
          linkedinUrl: row.linkedinUrl || undefined,
          industry: row.industry || undefined,
          hqLocation: row.hqLocation || undefined,
          notes: row.notes || undefined,
        },
      });
      created.push(company);
    } catch (err) {
      errors.push({ row, message: (err as Error).message });
    }
  }

  res.json({ createdCount: created.length, duplicates, errors });
});
