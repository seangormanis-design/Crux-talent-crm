import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { extractCvFields, extractTextFromCv } from "../lib/cvExtraction";

export const cvRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Pure extraction — nothing is saved here. The frontend shows the result
// in an editable form; only PATCH /api/people/:id (and, if the user wants
// the file kept, POST /api/documents) actually persists anything. This is
// CV-file parsing only — no LinkedIn or other web lookups are involved.
cvRouter.post("/parse", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A CV file (PDF or .docx) is required" });

  let text: string;
  try {
    text = await extractTextFromCv(req.file.buffer, req.file.mimetype, req.file.originalname);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }

  if (!text.trim()) {
    return res.status(422).json({ error: "Could not read any text from that file — it may be a scanned image." });
  }

  const knownSkills = await prisma.skill.findMany();
  const extracted = extractCvFields(text, knownSkills.map((s) => s.name));

  const matchedSkills = knownSkills.filter((s) => extracted.skillNames.includes(s.name));

  res.json({
    extracted: {
      name: extracted.name,
      email: extracted.email,
      phone: extracted.phone,
      currentTitle: extracted.currentTitle,
      currentEmployerName: extracted.currentEmployerName,
      skills: matchedSkills.map((s) => ({ id: s.id, name: s.name })),
    },
  });
});
