// Google Gemini AI client for content generation, moderation, etc.
// Uses GOOGLE_AI_API_KEY (Gemini API key from AI Studio: https://aistudio.google.com/apikey)
// 2026 Upgrade: gemini-2.5-flash — faster, better JSON, improved creative reasoning

const logger = require('./logger');

let genAI = null;
let model = null;
let embeddingModel = null;
let Sentry = null;

try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

// Per-call request timeout for Gemini. The SDK's default has no ceiling, so a
// stuck upstream can hang an editor request for minutes. 60s is generous for
// flash-tier text generation. Override with GEMINI_TIMEOUT_MS.
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '60000', 10);

const safetySettings = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
];

try {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: 'You are an elite creative director and copywriter. Generate high-impact content, scripts, and video metadata optimized for digital reach and maximum engagement.'
    });
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    logger.info(`🛡️ [GoogleAI] Model initialized (Key: ${apiKey.substring(0, 6)}...${apiKey.slice(-4)})`);
  } else {
    logger.warn('⚠️ [GoogleAI] No API key found; will use mock data in dev mode.');
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
  if (process.env.NODE_ENV === 'test' || !model) {
    if (process.env.NODE_ENV !== 'production' || process.env.NODE_ENV === 'test') {
      const lowerPrompt = prompt.toLowerCase();
      logger.info('🛡️ [GoogleAI] Dev Fallback: analyzing prompt for mock', { 
        promptLength: prompt.length,
        hasManifest: lowerPrompt.includes('manifest'),
        hasJsonObject: lowerPrompt.includes('json object'),
        hasScript: lowerPrompt.includes('script')
      });
      
      if (lowerPrompt.includes('video facts') || lowerPrompt.includes('recommendedcuts')) {
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
      
      if (lowerPrompt.includes('template')) {
        logger.info('🛡️ [GoogleAI] Returning mock template sections');
        return JSON.stringify({
          sections: [
            {
              name: "Hook",
              content: "In a world of constant content noise, only the sovereign creator stands out.",
              keyPoints: ["Break pattern", "Assert authority"]
            },
            {
              name: "Problem",
              content: "Traditional video editing pipelines are fragmented, manual, and drain creative energy.",
              keyPoints: ["High operational friction", "Time drain"]
            },
            {
              name: "Solution Steps",
              content: "Leverage Click's advanced neural workflow: 1. Feed the prompts, 2. Synthesize visual blueprints, 3. Deploy.",
              keyPoints: ["Speed", "Precision", "Automation"]
            },
            {
              name: "Tips",
              content: "Configure spacing, letter tracking, and high-energy transitions to maximize retention spikes.",
              keyPoints: ["Typographic control", "Visual alignment"]
            },
            {
              name: "Conclusion",
              content: "Sovereignty is yours. Click AI transitions you from coordinator to director.",
              keyPoints: ["Claim freedom", "Scale growth"]
            }
          ]
        });
      }

      if (lowerPrompt.includes('audience') && lowerPrompt.includes('angles')) {
        logger.info('🛡️ [GoogleAI] Returning mock Stage 1: Intelligence positioning');
        return JSON.stringify({
          audience: "Target Creators & Social Media Professionals",
          positioning: "Autonomous content factory utilizing advanced neural pipelines",
          topAngles: [
            { angle: "Efficiency Boost", trigger: "Time savings" },
            { angle: "Direct Influence", trigger: "Authenticity" },
            { angle: "Future Stack", trigger: "Technology" }
          ]
        });
      }

      if (lowerPrompt.includes('rawscript')) {
        logger.info('🛡️ [GoogleAI] Returning mock Stage 2: Raw Script');
        return JSON.stringify({
          title: "Unlocking Creative Autonomy in 2026",
          hook: "This secret hack will change your workflow forever. 🚀",
          rawScript: {
            hook: "This secret hack will change your workflow forever. 🚀",
            body: [
              "Traditional video editing pipelines are fragmented and drain creative energy.",
              "Stop doing this manually and leverage Click's advanced neural workflow.",
              "Sovereignty is yours once you shift from coordinator to director."
            ],
            cta: "Join the Sovereign Cluster today. Link in bio."
          },
          estimatedDurationSec: 30
        });
      }

      if (lowerPrompt.includes('polishedhook')) {
        logger.info('🛡️ [GoogleAI] Returning mock Stage 3: Refinery');
        return JSON.stringify({
          polishedHook: "This raw hack will redefine your creative workflow. 🚀",
          polishedBody: [
            "Manual editing pipelines are dead weight that exhaust creative drive.",
            "Calibrate Click's advanced neural engine and reclaim control.",
            "Reclaim your sovereignty. Transform from editor to ultimate director."
          ],
          polishedCta: "Ascend to the Sovereign Cluster now. Link in bio.",
          improvements: ["Stronger action verbs", "Replaced filler words with power verbs"]
        });
      }

      if (lowerPrompt.includes('viral content ideas') || lowerPrompt.includes('viral ideas') || (lowerPrompt.includes('generate') && lowerPrompt.includes('ideas'))) {
        logger.info('🛡️ [GoogleAI] Returning mock viral ideas');
        return JSON.stringify({
          ideas: Array(3).fill(0).map((_, i) => ({
            title: `Bespoke Sovereign Idea ${i + 1}`,
            description: `Bespoke strategy for modern creator economy`,
            hook: `Here is hook ${i + 1}`,
            platform: 'tiktok',
            potential: 90,
            velocityMultiplier: 1.5,
            reason: 'Matches pattern interrupt and high pacing',
            originalityScore: 95
          }))
        });
      }

      if (lowerPrompt.includes('hashtags') && lowerPrompt.includes('resonancescore')) {
        logger.info('🛡️ [GoogleAI] Returning mock Stage 5: Blueprint');
        return JSON.stringify({
          hashtags: ["#ClickAI", "#SovereignCreator", "#NeuralForge", "#FutureTech", "#InferenceHub", "#GrowthLattice", "#AIAgent"],
          ctaChain: ["Join the Sovereign Cluster today. Link in bio.", "Manifest your vision with Click AI."],
          thumbnailPrompt: "A futuristic neon workspace showing an holographic video timeline floating in the air, deep violet and cyan color grade.",
          postingWindow: "Tue 7pm",
          resonanceScore: 94,
          totalDuration: 30
        });
      }

      if (lowerPrompt.includes('json object') || lowerPrompt.includes('manifest') || lowerPrompt.includes('script')) {
        logger.info('🛡️ [GoogleAI] Returning mock manifest');
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
      
      if (lowerPrompt.includes('recommendations') || lowerPrompt.includes('personalized') || lowerPrompt.includes('trend') || lowerPrompt.includes('suggest')) {
        logger.info('🛡️ [GoogleAI] Returning mock recommendations / trend suggestions array');
        return JSON.stringify([
          {
            title: "Unlocking Autonomous Growth",
            description: "How autonomous workflows are shifting the content paradigm in 2026.",
            platform: "linkedin",
            reasoning: "High professional audience affinity with workflow efficiency templates.",
            trendAlignment: "Automation tech is up 140% this week.",
            expectedEngagement: "high",
            keyPoints: ["Autonomy", "Sovereignty", "2026 Stack"]
          },
          {
            title: "Stop Manual Editing Now",
            description: "Why manual video pipelines are dead weight that exhaust creative drive.",
            platform: "tiktok",
            reasoning: "Strong pattern interrupt matching high-pacing video trends.",
            trendAlignment: "Short-form video pacing is a top 5 trend.",
            expectedEngagement: "high",
            keyPoints: ["Time drain", "Sovereign director"]
          }
        ]);
      }

      const isJsonRequest = lowerPrompt.includes('json') || lowerPrompt.includes('format as array') || options.responseMimeType === 'application/json';
      if (isJsonRequest) {
        logger.info('🛡️ [GoogleAI] Returning generic mock JSON due to JSON request detection');
        if (lowerPrompt.includes('array') || lowerPrompt.includes('list')) {
          return JSON.stringify([{ title: "Sovereign Content Strategy", description: "Mock list item" }]);
        }
        return JSON.stringify({ success: true, status: "completed", message: "Mock response" });
      }

      logger.warn('🛡️ [GoogleAI] Prompt did not match any mock pattern, returning default fallback');
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
          topP: options.topP ?? 0.95,
          topK: options.topK ?? 40,
          responseMimeType: options.responseMimeType || (prompt.toLowerCase().includes('json') ? 'application/json' : undefined),
          // gemini-2.5-flash spends "thinking" tokens out of maxOutputTokens by
          // default, which silently TRUNCATES output (e.g. a 1000-budget script
          // came back at ~111 chars). This is a copywriting workload, not a
          // reasoning one, so disable thinking → the full budget goes to output
          // (also faster + cheaper). Callers can re-enable via options.thinkingBudget.
          thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
        },
        safetySettings,
      }, { timeout: GEMINI_TIMEOUT_MS });
      const response = result.response;
      if (!response || !response.text) return null;
      return response.text().trim();
    } catch (err) {
      const msg = err?.message || '';
      const isQuota = /429|RESOURCE_EXHAUSTED|quota|rate ?limit/i.test(msg);
      try {
        logger[isQuota ? 'warn' : 'error']('[GoogleAI] generateContent failed', {
          error: msg.slice(0, 240),
          isQuota,
        });
      } catch { /* logger optional */ }
      // Sentry tag if available so quota exhaustion surfaces in alerting
      // without crashing handlers.
      if (Sentry && typeof Sentry.captureMessage === 'function') {
        try { Sentry.captureMessage(`Gemini ${isQuota ? 'quota' : 'error'}: ${msg.slice(0, 100)}`, 'warning'); } catch (e) { /* ignore sentry errors */ }
      }
      return null;
    }
  };

  // Manual AI Request span so Gemini usage appears in Sentry AI Agents Insights
  if (Sentry && typeof Sentry.startSpan === 'function') {
    return Sentry.startSpan(
      {
        op: 'gen_ai.request',
        name: 'request gemini-2.5-flash',
        attributes: {
          'gen_ai.request.model': 'gemini-2.5-flash',
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
              topP: options.topP ?? 0.95,
              topK: options.topK ?? 40,
              responseMimeType: options.responseMimeType || (prompt.toLowerCase().includes('json') ? 'application/json' : undefined),
              // See note above — disable gemini-2.5 "thinking" so it can't starve
              // the output budget and truncate. Opt back in via options.thinkingBudget.
              thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
            },
            safetySettings,
          }, { timeout: GEMINI_TIMEOUT_MS });

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
          try {
            logger.error('[GoogleAI] generateContent failed (in span)', { 
              error: err?.message?.slice(0, 240),
              stack: err?.stack?.slice(0, 500)
            });
          } catch (le) { /* logger optional */ }
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
  if (process.env.NODE_ENV === 'test') {
    return new Array(768).fill(0.01);
  }
  if (!embeddingModel) return null;
  try {
    const result = await embeddingModel.embedContent(text, { timeout: GEMINI_TIMEOUT_MS });
    return result.embedding.values;
  } catch (err) {
    try {
      logger.error('[GoogleAI] Embedding failed:', { error: err.message });
      if (process.env.NODE_ENV !== 'production') {
        logger.info('🛡️ [GoogleAI] Dev Fallback: Returning mock embedding vector');
      }
    } catch (_) {
      // Logger invocation failed
    }
    if (process.env.NODE_ENV !== 'production') {
      return new Array(768).fill(0.01);
    }
    return null;
  }
}

module.exports = {
  client: model,
  generateContent,
  generateEmbeddings,
  isConfigured: !!model || process.env.NODE_ENV === 'test',
};
