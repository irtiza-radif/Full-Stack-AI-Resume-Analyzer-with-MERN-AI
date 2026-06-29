const { Mistral } = require('@mistralai/mistralai');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const client = env.mistralApiKey ? new Mistral({ apiKey: env.mistralApiKey }) : null;

const analyzeResume = async (resumeText) => {
  if (!client) {
    throw ApiError.internal('Mistral client configuration missing or invalid API key.');
  }

  try {
    // UPDATED PROMPT: Forces Mistral to output schema structures that match your MongoDB Models
   // UPDATED PROMPT: Changes 'message' to 'title' to satisfy your Mongoose Analysis Schema constraints
    const prompt = `
      You are an expert ATS (Applicant Tracking System) optimization algorithm and professional resume auditor.
      Analyze the provided resume text thoroughly and extract critical operational insights.
      
      You MUST return your complete analytical output strictly as a valid, parsable JSON object. 
      Do not include markdown tags like \`\`\`json or trailing conversational explanations.
      
      The structure must follow this format exactly:
      {
        "atsScore": 85, 
        "summary": "Deep professional summary reflecting matching strengths...",
        "scoreBreakdown": {
          "impact": 80,
          "brevity": 85,
          "style": 90
        },
        "strengths": [
          { "title": "Keyword Optimization", "description": "Excellent usage of industry keywords." }
        ],
        "issues": [
          { "type": "warning", "title": "Missing structural metric data.", "section": "experience" }
        ],
        "bulletRewrites": [
          { "original": "Worked on a web application.", "rewritten": "Architected responsive MERN stack features, increasing client engagement by 20%." }
        ],
        "keywordsPresent": ["React", "Node.js"],
        "keywordsMissing": ["Docker", "AWS"]
      }

      Resume Document Content to analyze:
      ${resumeText}
    `;

    const response = await client.chat.complete({
      model: env.mistralModel,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' } 
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('Empty response frame received from Mistral API paths.');
    }

    let rawContent = response.choices[0].message.content;
    
    if (Array.isArray(rawContent)) {
      rawContent = rawContent.map(block => block.text || '').join('');
    }

    if (!rawContent || typeof rawContent !== 'string') {
      throw new Error('Mistral returned an unparsable or empty content body format.');
    }
    
    return JSON.parse(rawContent.trim());

  } catch (error) {
    throw ApiError.internal(`Mistral analytics system failure: ${error.message}`);
  }
};

module.exports = { analyzeResume };