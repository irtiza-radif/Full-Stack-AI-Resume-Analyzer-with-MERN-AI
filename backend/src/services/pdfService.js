const pdfParse = require("pdf-parse"); // Standard functional library import
const ApiError = require("../utils/ApiError");

async function extractText(buffer) {
  try {
    // pdf-parse expects the raw buffer passed directly into the function
    const data = await pdfParse(buffer);

    const text = (data.text || "").trim();
    if (!text || text.length < 50) {
      throw ApiError.badRequest(
        "Could not extract readable text - is this a scanned/image-only PDF?"
      );
    }

    return {
      text,
      meta: {
        numPages: data.numpages ?? null,
      },
    };
  } catch (err) {
    if (err.isOperational) throw err;
    throw ApiError.badRequest("Failed to parse PDF: " + err.message);
  }
}

// CRUCIAL FIX: Explicitly export the function so resumes.js can read it!
module.exports = { extractText };
