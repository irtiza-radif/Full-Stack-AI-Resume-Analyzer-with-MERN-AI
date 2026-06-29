const mongoose = require("mongoose");

// Sub-schema for single issues
const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    explanation: String,
    fix: String,
  },
  { _id: false }
);

// Sub-schema for standout strengths
const strengthSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    evidence: String,
  },
  { _id: false }
);

// Sub-schema for AI text bullet rewrites
const bulletRewriteSchema = new mongoose.Schema(
  {
    section: String,
    original: String,
    rewritten: String,
    rationale: String,
  },
  { _id: false }
);

// Main Analysis Document Schema Structure
const analysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
    versionId: { type: mongoose.Schema.Types.ObjectId, ref: "ResumeVersion", required: true },
    atsScore: { type: Number, required: true },
    scoreBreakdown: {
      keywords: { type: Number, default: 0 },
      formatting: { type: Number, default: 0 },
      impact: { type: Number, default: 0 },
      clarity: { type: Number, default: 0 },
    },
    issues: [issueSchema],
    strengths: [strengthSchema],
    bulletRewrites: [bulletRewriteSchema],
    keywordsPresent: [{ type: String }],
    keywordsMissing: [{ type: String }],
    summary: { type: String },
    model: { type: String },
    promptTokens: { type: Number },
    responseTokens: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Analysis", analysisSchema);