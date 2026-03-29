// Google Gemini AI client for content generation, moderation, etc.
// Uses GOOGLE_AI_API_KEY (Gemini API key from AI Studio: https://aistudio.google.com/apikey)

let genAI = null;
let model = null;
let embeddingModel = null;
let Sentry = null;

try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' }); // Added this line
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

  const reqMessages = [{ role: 'user', content: prompt }];
  const runRequest = async () => {
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
  };

  // Manual AI Request span so Gemini usage appears in Sentry AI Agents Insights
  if (Sentry && typeof Sentry.startSpan === 'function') {
    return Sentry.startSpan(
      {
        op: 'gen_ai.request',
        name: 'request gemini-1.5-flash',
        attributes: {
          'gen_ai.request.model': 'gemini-1.5-flash',
          'gen_ai.operation.name': 'request',
          'gen_ai.request.messages': JSON.stringify(reqMessages),
          'gen_ai.request.max_tokens': options.maxTokens || 1024,
          'gen_ai.request.temperature': options.temperature ?? 0.7,
        },
      },
      async (span) => {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: options.maxTokens || 1024,
            temperature: options.temperature ?? 0.7,
          },
        });

        const response = result.response;
        if (!response || !response.text) return null;
        const text = response.text().trim();
        span.setAttribute('gen_ai.response.text', JSON.stringify([text]));

        const usage = response.usageMetadata || {};
        if (typeof usage.promptTokenCount === 'number') span.setAttribute('gen_ai.usage.input_tokens', usage.promptTokenCount);
        if (typeof usage.candidatesTokenCount === 'number') span.setAttribute('gen_ai.usage.output_tokens', usage.candidatesTokenCount);
        if (typeof usage.totalTokenCount === 'number') span.setAttribute('gen_ai.usage.total_tokens', usage.totalTokenCount);

        return text;
      }
    );
  }

  return runRequest();
}
/**
 * Generate embedding vectors for semantic RAG
 * @param {string} text - The input text
 * @returns {Promise<Array<number>|null>} Standardized embedding array
 */
async function generateEmbeddings(text) {
  if (!embeddingModel) return null;
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    console.error('Error generating embedding:', err);
    return null;
  }
}

module.exports = {
  client: model,
  generateContent,
  generateEmbeddings,
  isConfigured: !!model,
};
