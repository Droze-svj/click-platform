// Google Gemini AI client for content generation, moderation, transcription, etc.
// Uses GOOGLE_AI_API_KEY (Gemini API key from AI Studio: https://aistudio.google.com/apikey)
// This is the ONLY AI provider used by Click — see utils/openai.js for the
// Gemini-only enforcement story.

const fs = require('fs');
const path = require('path');

let genAI = null;
let model = null;
let proModel = null;
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
    proModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
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
    
    return null;
  }
}

/**
 * Transcribe an audio file using Gemini 1.5's native audio understanding.
 * Drop-in replacement for OpenAI Whisper transcribe calls. Reads the file as
 * a base64 inline part, sends it to gemini-1.5-flash with a transcription
 * instruction, returns plain text.
 *
 * @param {string} audioPath - Absolute path to an audio file (mp3/wav/m4a/ogg/flac).
 * @param {Object} options - { language?: string, prompt?: string }
 * @returns {Promise<string|null>} Transcript text, or null if Gemini is unavailable.
 */
async function transcribeAudio(audioPath, options = {}) {
  if (!model) return null;
  if (!audioPath || !fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  const ext = path.extname(audioPath).toLowerCase().replace('.', '');
  const mimeMap = { mp3: 'audio/mp3', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm' };
  const mimeType = mimeMap[ext] || 'audio/mpeg';

  const audioBuffer = await fs.promises.readFile(audioPath);
  const base64 = audioBuffer.toString('base64');

  const instruction = options.prompt
    || `Transcribe this audio verbatim${options.language ? ` in ${options.language}` : ''}. Return only the transcript text, no preamble.`;

  const result = await model.generateContent({
    contents: [{
      role: 'user',
      parts: [
        { text: instruction },
        { inlineData: { mimeType, data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.0, maxOutputTokens: 8192 },
  });

  const response = result.response;
  if (!response || !response.text) return null;
  return response.text().trim();
}

/**
 * Generate text from a multi-modal prompt (text + image / video / audio inline).
 * Use this where OpenAI vision calls were previously made.
 *
 * @param {Array} parts - Array of { text } and/or { inlineData: { mimeType, data } } objects.
 * @param {Object} options - { temperature, maxTokens, usePro }
 * @returns {Promise<string|null>}
 */
async function generateMultimodal(parts, options = {}) {
  const useModel = options.usePro ? proModel : model;
  if (!useModel) return null;

  const result = await useModel.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      maxOutputTokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.4,
    },
  });

  const response = result.response;
  if (!response || !response.text) return null;
  return response.text().trim();
}

module.exports = {
  client: model,
  proClient: proModel,
  generateContent,
  generateEmbeddings,
  transcribeAudio,
  generateMultimodal,
  isConfigured: !!model,
};
