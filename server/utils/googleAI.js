// Google Gemini AI client for content generation, moderation, etc.
// Uses GOOGLE_AI_API_KEY (Gemini API key from AI Studio: https://aistudio.google.com/apikey)
// 2026 Upgrade: gemini-2.0-flash — faster, better JSON, improved creative reasoning

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
    model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
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
  if (!model) {
    if (process.env.NODE_ENV !== 'production') {
      const logger = require('./logger');
      logger.info('🛡️ [GoogleAI] Dev Fallback: Generating high-fidelity mock response (No API Key)');
      
      // Intelligent mock based on prompt context
      if (prompt.includes('VIDEO FACTS') || prompt.includes('recommendedCuts')) {
        return JSON.stringify({
          recommendedCuts: [{ start: 0.5, end: 2.0, reason: "Dead air removal", confidence: 0.95 }],
          transitions: [],
          audioAdjustments: [],
          pacingImprovements: [],
          highlights: [],
          suggestedLength: 45,
          thumbnailMoments: [{ time: 1.2, reason: "High energy peak" }],
          suggestedEdits: ["Hook optimization for TikTok style", "Increase pacing in middle segment"],
          contentType: "short_form",
          hookScore: 92,
          hookText: "Wait until you see how Click AI transforms this workflow!",
          viralMoments: [{ time: 3.5, text: "Paradigm shift!", reason: "High energy punchline", emotion: "shock", triggerType: "value" }],
          suggestedCaptions: [{ text: "PARADIGM SHIFT", startTime: 3.5, endTime: 5.0, style: "punchline" }],
          niche: "tech",
          topPlatform: "tiktok",
          cta: "Manifest your vision with Click AI.",
          narrativeStructure: "problem-solution"
        });
      }
      
      if (prompt.includes('JSON object') || prompt.includes('manifest')) {
        return JSON.stringify({
          hooks: [
            { text: "This secret hack will change your workflow forever. 🚀", trigger: "Curiosity & Efficiency" },
            { text: "Stop doing this if you want to scale in 2026. 🛑", trigger: "Fear of Missing Out" },
            { text: "The truth about Click AI that nobody is telling you.", trigger: "Pattern Interrupt" }
          ],
          script: "In the evolving landscape of digital creation, autonomy isn't just a feature—it's the engine of sovereignty. Today, we're diving deep into the Click Neural Forge, where high-fidelity inference meets seamless execution. [Pause] Most creators are stuck in the manual loop, but with the 2026 stack, we're shifting the paradigm. Here's how you can leverage semantic logic to automate your growth lattice...",
          cta: ["Join the Sovereign Cluster today. Link in bio.", "Manifest your vision with Click AI."],
          hashtags: ["#ClickAI", "#SovereignCreator", "#NeuralForge", "#FutureTech", "#InferenceHub"],
          resonanceScore: 94
        });
      }
      
      return "This is a high-fidelity autonomous manifest generated via Click Dev Fallback. In production, this would be synthesized by Gemini 1.5 Pro.";
    }
    return null;
  }

  const reqMessages = [{ role: 'user', content: prompt }];
  const runRequest = async () => {
    // Wrap the upstream call so quota / rate-limit / network errors degrade
    // to `null` instead of bubbling up. Every caller in the codebase already
    // checks for null + falls through to a structured fallback (e.g.
    // `content || defaultCaption`). Bubbling 429s breaks the editor for the
    // entire day until quota resets, even when graceful copy is fine.
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
    } catch (err) {
      const msg = err?.message || '';
      const isQuota = /429|RESOURCE_EXHAUSTED|quota|rate ?limit/i.test(msg);
      try {
        const logger = require('./logger');
        logger[isQuota ? 'warn' : 'error']('[GoogleAI] generateContent failed', {
          error: msg.slice(0, 240),
          isQuota,
        });
      } catch { /* logger optional */ }
      // Sentry tag if available so quota exhaustion surfaces in alerting
      // without crashing handlers.
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        try { Sentry.captureMessage(`Gemini ${isQuota ? 'quota' : 'error'}: ${msg.slice(0, 100)}`, 'warning'); } catch {}
      }
      return null;
    }
  };

  // Manual AI Request span so Gemini usage appears in Sentry AI Agents Insights
  if (Sentry && typeof Sentry.startSpan === 'function') {
    return Sentry.startSpan(
      {
        op: 'gen_ai.request',
        name: 'request gemini-2.0-flash',
        attributes: {
          'gen_ai.request.model': 'gemini-2.0-flash',
          'gen_ai.operation.name': 'request',
          'gen_ai.request.messages': JSON.stringify(reqMessages),
          'gen_ai.request.max_tokens': options.maxTokens || 1024,
          'gen_ai.request.temperature': options.temperature ?? 0.7,
        },
      },
      async (span) => {
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
          const text = response.text().trim();
          span.setAttribute('gen_ai.response.text', JSON.stringify([text]));

          const usage = response.usageMetadata || {};
          if (typeof usage.promptTokenCount === 'number') span.setAttribute('gen_ai.usage.input_tokens', usage.promptTokenCount);
          if (typeof usage.candidatesTokenCount === 'number') span.setAttribute('gen_ai.usage.output_tokens', usage.candidatesTokenCount);
          if (typeof usage.totalTokenCount === 'number') span.setAttribute('gen_ai.usage.total_tokens', usage.totalTokenCount);

          return text;
        } catch (err) {
          // Mirror the no-Sentry path: degrade to null on any upstream
          // failure (quota, rate-limit, network) so callers fall through to
          // their structured fallbacks rather than 500-ing the request.
          span.setStatus?.({ code: 'error', message: (err?.message || '').slice(0, 100) })
          return null;
        }
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

module.exports = {
  client: model,
  generateContent,
  generateEmbeddings,
  isConfigured: !!model || (process.env.NODE_ENV !== 'production'),
};
