const { generateContent } = require('../utils/googleAI');
const logger = require('../utils/logger');

/**
 * Compatibility layer for older services requiring geminiService
 * @param {string} prompt - The prompt text
 * @param {Object} options - { maxTokens, temperature }
 * @returns {Promise<Object>} Processed response
 */
async function callGemini(prompt, options = {}) {
  const response = await generateContent(prompt, options);
  
  // Try to parse as JSON if it looks like JSON
  if (response && (response.trim().startsWith('{') || response.trim().startsWith('['))) {
    try {
      return JSON.parse(response);
    } catch (e) {
      logger.warn('[GeminiService] Response looked like JSON but failed to parse', { error: e.message });
    }
  }
  
  return response;
}

module.exports = {
  callGemini,
  generateContent: callGemini // Backwards compatibility for both names
};
