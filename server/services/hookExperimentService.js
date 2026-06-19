// Hook/CTA A/B auto-generation — generate distinct hook angles (curiosity /
// authority / FOMO), distribute them across staggered slots so they don't
// cannibalize, and pick a winner from real engagement. The angle templates,
// slot distribution, and winner evaluation are PURE cores; the generator uses
// aiRouter with an honest template fallback (never fabricated metrics).

const aiRouter = require('../utils/aiRouter');
const logger = require('../utils/logger');

// The three angles, each with a deterministic template used as the honest
// fallback when AI is unavailable (clearly a starting-draft, not fake data).
const HOOK_ANGLES = [
  { key: 'curiosity', label: 'Curiosity', template: (t) => `The one thing nobody tells you about ${t}…` },
  { key: 'authority', label: 'Authority', template: (t) => `Here's what actually works for ${t} (from experience)` },
  { key: 'fomo', label: 'FOMO', template: (t) => `Stop scrolling — you're missing this about ${t}` },
];

function topicFrom(baseText) {
  const words = String(baseText || '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return words.length ? words.join(' ') : 'this';
}

/**
 * PURE: assign each variant a distinct posting slot. If `windows` (optimal
 * windows) are supplied, use them in order; otherwise stagger by spacingHours.
 */
function distributeSlots(variants = [], windows = [], options = {}) {
  const spacingHours = Number(options.spacingHours) || 24;
  const list = Array.isArray(variants) ? variants : [];
  const wins = Array.isArray(windows) ? windows : [];
  return list.map((v, i) => ({
    ...v,
    slotIndex: i,
    scheduledWindow: wins[i] || null,
    slotOffsetHours: wins[i] ? null : i * spacingHours,
  }));
}

/**
 * PURE: evaluate an experiment's results → winner by engagement rate, lift over
 * the runner-up, and whether the result is statistically trustworthy (both arms
 * have enough impressions AND the lift clears the threshold).
 *   → { winner, ranked, lift, confident, reason }
 */
function evaluateHookExperiment(variantResults = [], options = {}) {
  const minImpressions = Number(options.minImpressions) || 100;
  const minLiftPct = Number(options.minLiftPct) || 5;

  const ranked = (Array.isArray(variantResults) ? variantResults : [])
    .filter((v) => v && (v.id || v.angle))
    .map((v) => {
      const impressions = Math.max(0, Number(v.impressions) || 0);
      const engagement = Math.max(0, Number(v.engagement) || 0);
      const rate = impressions > 0 ? engagement / impressions : 0;
      return {
        id: v.id || v.angle,
        angle: v.angle || null,
        impressions,
        engagement,
        engagementRate: Math.round(rate * 10000) / 10000,
      };
    })
    .sort((a, b) => b.engagementRate - a.engagementRate);

  if (ranked.length < 2) {
    return { winner: ranked[0] || null, ranked, lift: 0, confident: false, reason: 'insufficient_variants' };
  }
  const [top, runnerUp] = ranked;
  const lift = runnerUp.engagementRate > 0
    ? ((top.engagementRate - runnerUp.engagementRate) / runnerUp.engagementRate) * 100
    : (top.engagementRate > 0 ? 100 : 0);
  const confident = top.impressions >= minImpressions && runnerUp.impressions >= minImpressions && lift >= minLiftPct;
  return {
    winner: top,
    ranked,
    lift: Math.round(lift * 10) / 10,
    confident,
    reason: confident ? 'significant' : 'inconclusive',
  };
}

/**
 * Generate one hook per angle for `baseText`, then distribute across slots.
 * Uses aiRouter; on any failure each variant falls back to its angle template
 * (source:'template'), so the experiment always returns 3 usable variants.
 */
async function generateHookExperiment(baseText, opts = {}) {
  const topic = topicFrom(baseText);
  let aiHooks = null;

  const prompt =
    `Write 3 short, scroll-stopping video hooks for this content: "${String(baseText || '').slice(0, 400)}".\n` +
    `One per angle — curiosity, authority, FOMO. Each under 120 characters, no hashtags.\n` +
    `Return JSON: {"hooks":[{"angle":"curiosity","hook":"..."},{"angle":"authority","hook":"..."},{"angle":"fomo","hook":"..."}]}`;

  try {
    const r = await aiRouter.aiCallJson(prompt, null, {
      taskType: 'hook-ab', maxTokens: 500, temperature: 0.9, userId: opts.userId,
    });
    if (r && Array.isArray(r.hooks)) aiHooks = r.hooks;
  } catch (err) {
    logger.warn('[hookExperiment] AI generation failed, using templates', { error: err.message });
  }

  const variants = HOOK_ANGLES.map((a) => {
    const match = aiHooks && aiHooks.find((h) => h && String(h.angle || '').toLowerCase() === a.key);
    const aiHook = match && typeof match.hook === 'string' ? match.hook.trim() : '';
    return {
      angle: a.key,
      label: a.label,
      hook: aiHook ? aiHook.slice(0, 200) : a.template(topic),
      source: aiHook ? 'ai' : 'template',
    };
  });

  return {
    topic,
    variants: distributeSlots(variants, opts.windows, { spacingHours: opts.spacingHours }),
    generatedWith: variants.every((v) => v.source === 'ai') ? 'ai' : (variants.some((v) => v.source === 'ai') ? 'mixed' : 'template'),
  };
}

module.exports = {
  HOOK_ANGLES,
  distributeSlots,
  evaluateHookExperiment,
  generateHookExperiment,
};
