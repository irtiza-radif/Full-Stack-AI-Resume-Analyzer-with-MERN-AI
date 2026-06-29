const { z } = require("zod");
const env = require("../config/env");

// Zod schema remains perfectly intact to protect database schema integrity
const validator = z.object({
  basics: z.object({
    name: z.string().default(""),
    title: z.string().default(""),
    location: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
  summary: z.string().default(""),
  experience: z
    .array(
      z.object({
        company: z.string().default(""),
        role: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        bullets: z.array(z.string()).default([]),
      })
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string().default(""),
        school: z.string().default(""),
        location: z.string().default(""),
        period: z.string().default(""),
        details: z.string().default(""),
      })
    )
    .default([]),
  skills: z.array(z.string()).default([]),
  projects: z
    .array(
      z.object({
        name: z.string().default(""),
        description: z.string().default(""),
        tech: z.array(z.string()).default([]),
        links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
      })
    )
    .default([]),
  certifications: z
    .array(
      z.object({
        name: z.string().default(""),
        issuer: z.string().default(""),
        year: z.string().default(""),
      })
    )
    .default([]),
  languages: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
});

function buildPrompt(rawText) {
  return [
    'You are an advanced resume parser. The input is text extracted from a PDF - lines may be jumbled or out of natural reading order.',
    '',
    'Extract structured data matching this JSON model example format exactly:',
    '{',
    '  "basics": { "name": "", "title": "", "location": "", "email": "", "phone": "", "links": [{ "label": "", "url": "" }] },',
    '  "summary": "",',
    '  "experience": [{ "company": "", "role": "", "location": "", "period": "", "bullets": [""] }],',
    '  "education": [{ "degree": "", "school": "", "location": "", "period": "", "details": "" }],',
    '  "skills": [""],',
    '  "projects": [{ "name": "", "description": "", "tech": [""], "links": [{ "label": "", "url": "" }] }],',
    '  "certifications": [{ "name": "", "issuer": "", "year": "" }],',
    '  "languages": [""],',
    '  "interests": [""]',
    '}',
    '',
    'Rules:',
    '- Be conservative: omit fields that are not clearly present. Use empty strings/arrays where missing.',
    '- Do not invent or paraphrase - extract verbatim where possible.',
    '- Each experience bullet should read as a complete sentence.',
    '- Preserve original date formats (e.g. \'Jan 2022 - Dec 2023\').',
    '',
    'RESUME TEXT:',
    '-----------',
    rawText,
    '-----------',
  ].join('\n');
}

const EMPTY = {
  basics: { name: "", title: "", location: "", email: "", phone: "", links: [] },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  interests: [],
};

/**
 * Parses raw text into a clean structured resume payload using Mistral AI
 */
async function parseResume(rawText) {
  if (!env.mistralApiKey || !rawText?.trim()) return EMPTY;

  const prompt = buildPrompt(rawText);

  // Keeps your exact 2-attempt fault tolerance matrix running smoothly
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // Dynamically load the ESM package at runtime to satisfy Netlify's CommonJS compiler
      const { Mistral } = await import("@mistralai/mistralai");
      
      const client = new Mistral({ apiKey: env.mistralApiKey });

      const response = await client.chat.complete({
        model: env.mistralModel || 'mistral-large-latest',
        messages: [{ role: "user", content: prompt }],
        // Instructs Mistral to strictly return a valid, parsable JSON string
        responseFormat: { type: "json_object" },
        temperature: 0.1,
      });

      if (!response.choices || response.choices.length === 0) {
        throw new Error("Empty response frame from Mistral endpoint.");
      }

      const text = response.choices[0].message.content;
      if (!text) throw new Error("Empty content payload");

      const parsed = JSON.parse(text);
      return validator.parse(parsed);
    } catch (err) {
      if (attempt === 2) {
        console.error("Mistral structured parse failed permanently:", err.message);
        return EMPTY;
      }
    }
  }
  return EMPTY;
}

module.exports = { parseResume };