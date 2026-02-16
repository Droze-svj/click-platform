// Google Gemini AI client for content generation, moderation, etc.
// Uses GOOGLE_AI_API_KEY (Gemini API key from AI Studio: https://aistudio.google.com/apikey)

let genAI = null;
let model = null;

try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
} catch (err) {
  // Package not installed or init failed
}

/**
 * Generate text completion from a prompt
 * @param {string} prompt - The prompt text
 * @param {Object} options - { maxTokens, temperature }
 * @returns {Promise<string|null>} Generated text or null if unavailable
 */
async function generateContent(prompt, options = {}) {
  if (!model) return null;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature ?? 0.7,
      },
    });

    const response = result.response;
    if (!response || !response.text) return null;
    return response.text().trim();
  } catch (error) {
    throw error;
  }
}

module.exports = {
  client: model,
  generateContent,
  isConfigured: !!model,
};
