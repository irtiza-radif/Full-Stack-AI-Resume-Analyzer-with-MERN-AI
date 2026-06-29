// backend/src/services/mistralService.js

/**
 * Executes a resume analysis using the Mistral AI SDK via dynamic imports
 * to bypass CommonJS/ES Module compatibility limitations on serverless architectures.
 * 
 * @param {string} resumeText - The extracted text data from the resume PDF.
 * @param {string} jobDescription - The target position description to compare against.
 * @returns {Promise<Object>} The parsed JSON metrics from the AI analysis.
 */
const analyzeResumeWithMistral = async (resumeText, jobDescription) => {
  try {
    // 1. Resolve ESM package dynamically at runtime to handle Netlify's bundler
    const { Mistral } = await import('@mistralai/mistralai');

    // 2. Initialize the client using configuration from global process environment
    const client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY || ''
    });

    // 3. Define a structured system prompt to ensure clean JSON output
    const systemPrompt = `
      You are an expert Applicant Tracking System (ATS) optimization engine and senior technical recruiter. 
      Analyze the provided resume text against the target job description.
      You must respond with a valid, clean JSON object containing exactly the following keys:
      {
        "score": (number between 0 and 100),
        "summary": "Short professional match summary overview string",
        "matchedKeywords": ["keyword1", "keyword2"],
        "missingKeywords": ["keyword1", "keyword2"],
        "recommendations": ["improvement1", "improvement2"]
      }
      Do not include markdown tags like \`\`\`json or trailing commentary outside the JSON body.
    `;

    const userPrompt = `
      JOB DESCRIPTION:
      ${jobDescription}

      RESUME TEXT:
      ${resumeText}
    `;

    // 4. Send the payload to the latest Mistral completion endpoint
    const response = await client.chat.complete({
      model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      responseFormat: { type: 'json_object' } // Enforces strict JSON return type
    });

    // 5. Safely pull and format the raw content block
    const rawContent = response.choices[0].message.content;
    
    // Parse the JSON string into an object to feed smoothly to your MongoDB controller
    return JSON.parse(rawContent);

  } catch (error) {
    console.error('Mistral Service Engine Processing Error:', error.message);
    throw new Error(`Failed to complete AI processing: ${error.message}`);
  }
};

module.exports = {
  analyzeResumeWithMistral
};