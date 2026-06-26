/**
 * nextBestContentService — "What should I make next?"
 *
 * A ranked make-next list GROUNDED in the creator's OWN proven top performers
 * (hooks / captions / color grades / platforms learned by the loop), shaped by the
 * LLM through the same personalized system prompt every other AI surface uses.
 *
 * Honesty contract (per the project invariants):
 *   - We only "ground" claims in REAL data. `persona.topPerformers` is null until
 *     the learning loop has ≥3 samples (marketingKnowledge minSamples) — until then
 *     we return an explicit { hasRealData:false, reason:'need-more-data' }. No
 *     fabricated ideas, no invented lift numbers.
 *   - `expectedLift` is the model's SHORT qualitative estimate ("high"/"moderate"),
 *     never a fake percentage.
 *   - Best-effort + per-user scoped: never throws to the caller.
 */

'use strict';

const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const personalizationService = require('./personalizationService');
const logger = require('../utils/logger');

const NEED_DATA = (reason = 'need-more-data') => ({ hasRealData: false, reason, ideas: [] });

function safeArr(a, n) {
  return (Array.isArray(a) ? a : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, n);
}

function extractJsonArray(text) {
  const m = String(text || '').match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    return Array.isArray(v) ? v : null;
  } catch (_) {
    return null;
  }
}

// Shape one raw LLM idea into the contract; drop anything without a title.
function shapeIdea(raw, fallbackPlatform) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 160) : '';
  if (!title) return null;
  return {
    title,
    hook: typeof raw.hook === 'string' ? raw.hook.trim().slice(0, 240) : '',
    platform: (typeof raw.platform === 'string' && raw.platform.trim()) || fallbackPlatform || 'tiktok',
    why: typeof raw.why === 'string' ? raw.why.trim().slice(0, 240) : '',
    // The model's qualitative estimate ONLY — we never fabricate a numeric lift.
    expectedLift: typeof raw.expectedLift === 'string' ? raw.expectedLift.trim().slice(0, 80) : null,
  };
}

/**
 * getNextBest — ranked "what to make next", grounded in the creator's proven data.
 * @param {string} userId
 * @param {object} [opts]
 * @param {number} [opts.count=4]
 * @param {string} [opts.niche]
 * @param {string} [opts.platform]
 * @returns {Promise<{hasRealData:boolean, reason?:string, sampleSize?:number, niche?:string, groundedOn?:object, ideas:Array}>}
 */
async function getNextBest(userId, { count = 4, niche, platform } = {}) {
  if (!userId || String(userId).startsWith('dev-')) return NEED_DATA();
  const n = Math.max(1, Math.min(8, Number(count) || 4));

  let persona;
  try {
    persona = await personalizationService.getPersona(userId, { niche, platform });
  } catch (e) {
    logger.warn('[nextBest] persona read failed', { error: e.message });
    return NEED_DATA('error');
  }

  const tp = persona && persona.topPerformers;
  // Honesty gate: ground ONLY in real proven data. topPerformers is null until the
  // loop has enough samples — until then we say so instead of inventing ideas.
  if (!tp || !tp.sampleSize) return NEED_DATA();

  const provenHooks = safeArr(tp.topHooks, 4);
  const provenCaptions = safeArr(tp.topCaptions, 3);
  const provenColors = safeArr(tp.topColorGrades, 3);
  const theNiche = persona.niche || niche || 'general';
  const topPlatform = platform || 'tiktok';

  if (!geminiConfigured) return NEED_DATA('ai-unavailable');

  // Full personalization (top performers + voice + the "avoid" mistake lines) so the
  // model is grounded in THIS exact creator. Reuse the persona we already loaded.
  let system = '';
  try {
    system = await personalizationService.buildPersonalizedSystemPrompt({
      userId, niche: theNiche, platform: topPlatform, role: 'creative-director', stage: 'ideation', persona,
    });
  } catch (_) {
    system = '';
  }

  const groundLines = [
    provenHooks.length ? `Their proven hook frameworks: ${provenHooks.join(', ')}.` : '',
    provenCaptions.length ? `Proven caption styles: ${provenCaptions.join(', ')}.` : '',
    provenColors.length ? `Proven color grades: ${provenColors.join(', ')}.` : '',
    `Niche: ${theNiche}. Sample size behind this: ${tp.sampleSize}.`,
  ].filter(Boolean).join('\n');

  const userPrompt = `${system}

Based ONLY on what has ALREADY worked for THIS creator (below), recommend the ${n} best pieces of content for them to make NEXT. Rank best-first.

${groundLines}

For each idea return: title, hook (use ONE of their proven frameworks), platform (one of their best), why (name the specific proven strength it leans on — no generic filler), expectedLift (a SHORT qualitative phrase like "high" or "moderate" — NEVER a fake percentage).

Return ONLY a JSON array of objects with fields: title, hook, platform, why, expectedLift.`;

  let raw;
  try {
    raw = await geminiGenerate(userPrompt, { temperature: 0.7, maxTokens: 1200 });
  } catch (e) {
    logger.warn('[nextBest] generation failed', { error: e.message });
    return NEED_DATA('error');
  }

  const parsed = extractJsonArray(raw);
  if (!parsed) return NEED_DATA('parse-failed');

  const ideas = parsed.map((r) => shapeIdea(r, topPlatform)).filter(Boolean).slice(0, n);
  if (!ideas.length) return NEED_DATA('parse-failed');

  return {
    hasRealData: true,
    sampleSize: tp.sampleSize,
    niche: theNiche,
    groundedOn: { hooks: provenHooks, captions: provenCaptions, colorGrades: provenColors },
    ideas,
  };
}

module.exports = { getNextBest };
