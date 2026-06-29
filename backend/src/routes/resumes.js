const express = require("express");
const { z } = require("zod");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { requireAuth } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { uploadPdf } = require("../middleware/upload");
const Resume = require("../models/Resume");
const ResumeVersion = require("../models/ResumeVersion");

// ANALYSIS MODELS & SERVICES
const { analyzeLimiter } = require("../middleware/rateLimit");
const Analysis = require("../models/Analysis");
const { analyzeResume } = require('../services/mistralService'); 
const { diffText, summarize } = require('../services/diffService');

// CORE PARSING IMPORTS
const { extractText } = require("../services/pdfService");
const { parseResume: parseStructured } = require("../services/structuredParser");

const router = express.Router();
router.use(requireAuth);

const objectIdSchema = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v), { message: "Invalid id" });

const idParam = z.object({ id: objectIdSchema });

const analyzeBody = z.object({
  versionId: objectIdSchema.optional(),
  targetRole: z.string().trim().max(120).optional(),
});

async function loadOwnedResume(req) {
  const resume = await Resume.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });
  if (!resume) throw ApiError.notFound("Resume not found");
  return resume;
}

async function loadVersion(resumeId, versionId) {
  const version = await ResumeVersion.findOne({ _id: versionId, resumeId });
  if (!version) throw ApiError.notFound("Version not found");
  return version;
}

// 1. POST /api/resumes/ (Upload and initial Parse)
router.post(
  "/",
  uploadPdf,
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw ApiError.badRequest("No resume file uploaded");
    }
    const { text, meta } = await extractText(req.file.buffer);
    const parsedSections = await parseStructured(text);
    const title =
      (req.body.title || "").trim() ||
      req.file.originalname.replace(/\.pdf$/i, "") ||
      "Untitled Resume";

    const resume = await Resume.create({
      userId: req.user._id,
      title,
      latestVersionNumber: 1,
    });

    const version = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: 1,
      label: "V1",
      rawText: text,
      parsedSections,
      sourceType: "upload",
      parentVersionId: null,
    });
    
    resume.currentVersionId = version._id;
    await resume.save();
    res.status(201).json({ resume, version, meta });
  })
);

// 2. POST /api/resumes/:id/analyze (AI Evaluation)
router.post(
  "/:id/analyze",
  analyzeLimiter,
  validate(idParam, "params"),
  validate(analyzeBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const versionId = req.body.versionId || resume.currentVersionId;
    if (!versionId) throw ApiError.badRequest("No version to analyze");
    const version = await loadVersion(resume._id, versionId);
    const inputContent = `Target Role: ${req.body.targetRole || "General Professional"}\n\nResume Text:\n${version.rawText}`;
    
    const analysisResponse = await analyzeResume(inputContent);
    if (!analysisResponse) {
      throw ApiError.internal("Mistral engine failed to construct analytics metrics output payload.");
    }

    const saved = await Analysis.create({
      userId: req.user._id,
      resumeId: resume._id,
      versionId: version._id,
      atsScore: analysisResponse.atsScore ?? 70,
      scoreBreakdown: analysisResponse.scoreBreakdown || { impact: 70, brevity: 70, style: 70 },
      issues: analysisResponse.issues || [], 
      strengths: analysisResponse.strengths || [], 
      bulletRewrites: analysisResponse.bulletRewrites || [],
      keywordsPresent: analysisResponse.keywordsPresent || [],
      keywordsMissing: analysisResponse.keywordsMissing || [],
      summary: analysisResponse.summary || "Analysis processing complete.",
      model: "mistral-large-latest",
      promptTokens: 0,
      responseTokens: 0,
    });
    res.status(201).json(saved);
  })
);

// 3. GET /api/resumes/:id/analyses (Get All Analyses for a Resume)
router.get(
  "/:id/analyses",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const analyses = await Analysis.find({ resumeId: resume._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ analyses });
  })
);

// 4a. GET /api/resumes/:id/versions/:versionId (Fetches Version Document with correct structure wrapper)
router.get(
  "/:id/versions/:versionId",
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    res.json({ version }); 
  })
);

// 4b. GET /api/resumes/:id/versions/:versionId/analysis (Fetches Analysis for a Version)
router.get(
  "/:id/versions/:versionId/analysis",
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const version = await loadVersion(resume._id, req.params.versionId);
    const analysis = await Analysis.findOne({
      resumeId: resume._id,
      versionId: version._id,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ analysis: analysis || null });
  })
);

// 5. GET /api/resumes/ (List User's Resumes)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const resumes = await Resume.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ resumes });
  })
);

// 6. GET /api/resumes/:id (Get Resume and its versions list)
router.get(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const versions = await ResumeVersion.find({ resumeId: resume._id })
      .sort({ versionNumber: 1 })
      .select("-rawText")
      .lean();
    res.json({ resume, versions });
  })
);

// 7. DELETE /api/resumes/:id (Remove Resume and Versions)
router.delete(
  "/:id",
  validate(idParam, "params"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    await ResumeVersion.deleteMany({ resumeId: resume._id });
    await resume.deleteOne();
    res.json({ ok: true });
  })
);

const rewriteBody = z.object({
  analysisId: objectIdSchema,
  rewriteIds: z.array(objectIdSchema).optional(),
  label: z.string().trim().max(40).optional(),
});

function applyRewritesToText(rawText, rewrites) {
  let result = rawText;
  for (const r of rewrites) {
    if (!r.original || !r.rewritten) continue;
    const idx = result.indexOf(r.original);
    if (idx >= 0) {
      result = result.slice(0, idx) + r.rewritten + result.slice(idx + r.original.length);
    } else {
      result += `\n${r.rewritten}`;
    }
  }
  return result;
}

function patchBulletsInSections(sections, rewrites) {
  if (!sections) return null;
  const cloned = JSON.parse(JSON.stringify(sections));
  for (const r of rewrites) {
    if (!r.original || !r.rewritten) continue;
    for (const exp of cloned.experience || []) {
      if (!Array.isArray(exp.bullets)) continue;
      exp.bullets = exp.bullets.map((b) =>
        b === r.original ? r.rewritten : b
      );
    }
  }
  return cloned;
}

function looksEmpty(sections) {
  if (!sections) return true;
  const b = sections.basics || {};
  const hasIdentity = b.name || b.email || b.title;
  const hasBody =
    sections.summary ||
    sections.experience?.length ||
    sections.education?.length ||
    sections.skills?.length;
  return !hasIdentity && !hasBody;
}

router.post(
  "/:id/rewrite",
  validate(idParam, "params"),
  validate(rewriteBody),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const analysis = await Analysis.findOne({
      _id: req.body.analysisId,
      resumeId: resume._id,
    });
    if (!analysis) throw ApiError.notFound("Analysis not found");
    const baseVersion = await loadVersion(resume._id, analysis.versionId);
    
    const selected = req.body.rewriteIds?.length
      ? analysis.bulletRewrites.filter((r) =>
          req.body.rewriteIds.includes(r._id.toString())
        )
      : analysis.bulletRewrites;
      
    if (!selected.length) {
      throw ApiError.badRequest("No rewrites selected to apply");
    }
    
    const newRaw = applyRewritesToText(baseVersion.rawText, selected);
    const patchedFromBase = patchBulletsInSections(
      baseVersion.parsedSections,
      selected
    );
    const reparsed = await parseStructured(newRaw);
    const finalParsed = looksEmpty(reparsed) ? patchedFromBase : reparsed;
    const nextNumber = resume.latestVersionNumber + 1;
    
    const newVersion = await ResumeVersion.create({
      resumeId: resume._id,
      versionNumber: nextNumber,
      label: req.body.label?.trim() || `V${nextNumber}`,
      rawText: newRaw,
      parsedSections: finalParsed,
      sourceType: "rewrite",
      parentVersionId: baseVersion._id,
    });
    
    resume.latestVersionNumber = nextNumber;
    resume.currentVersionId = newVersion._id;
    await resume.save();
    
    res.status(201).json({
      version: newVersion,
      appliedCount: selected.length,
    });
  })
);

const diffQuery = z.object({
  from: objectIdSchema,
  to: objectIdSchema,
  mode: z.enum(["words", "lines"]).optional(),
});

router.get(
  "/:id/diff",
  validate(idParam, "params"),
  validate(diffQuery, "query"),
  asyncHandler(async (req, res) => {
    const resume = await loadOwnedResume(req);
    const [fromV, toV] = await Promise.all([
      loadVersion(resume._id, req.query.from),
      loadVersion(resume._id, req.query.to),
    ]);
    const parts = diffText(fromV.rawText, toV.rawText, req.query.mode);
    res.json({
      from: { id: fromV._id, label: fromV.label, versionNumber: fromV.versionNumber },
      to: { id: toV._id, label: toV.label, versionNumber: toV.versionNumber },
      parts,
      stats: summarize(parts),
    });
  })
);

module.exports = router;