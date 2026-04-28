/**
 * trendComposer.js — produces a niche × platform × language trend report by
 * asking Gemini to interpret the marketing-knowledge playbooks against
 * "current 2026" content patterns. No external scraping.
 *
 * Output shape (stable, schema-constrained):
 *   {
 *     niche, platform, language, generatedAt, source: 'ai' | 'fallback',
 *     hooks:    [{ id, label, framework, example, momentum }],
 *     sounds:   [{ id, label, energy, useCase }],
 *     formats:  [{ id, label, length, structure }],
 *     overlays: [{ id, label, style, when }],
 *     hashtags: { primary: string[], niche: string[], trending: string[] },
 *     engagement: { score, momentum }
 *   }
 *
 * On Gemini failure / quota / parse error, returns a structured fallback
 * built directly from the playbooks so the UI never empty-states.
 */

const logger = require('../utils/logger');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const {
  getKnowledgeSlice,
  buildSystemPrompt,
  HOOK_FRAMEWORKS,
} = require('./marketingKnowledge');

const SCHEMA_PROMPT = `Return ONLY valid JSON matching this exact schema (no prose, no code fences):
{
  "hooks":   [{ "id": string, "label": string, "framework": string, "example": string, "momentum": "rising"|"steady"|"peaking" }],
  "sounds":  [{ "id": string, "label": string, "energy": "low"|"medium"|"high", "useCase": string }],
  "formats": [{ "id": string, "label": string, "length": string, "structure": string }],
  "overlays":[{ "id": string, "label": string, "style": string, "when": string }],
  "hashtags": { "primary": string[], "niche": string[], "trending": string[] },
  "engagement": { "score": number, "momentum": "rising"|"steady"|"peaking" }
}
Aim for 5-7 hooks, 4-6 sounds, 3-5 formats, 4-6 overlays, 3-5 of each hashtag bucket.`;

function fallbackReport(slice) {
  const np = slice.nichePlaybook;
  const pp = slice.platformPlaybook;
  const angles = np.angles || [];
  const triggers = np.triggers || [];
  return {
    hooks: HOOK_FRAMEWORKS.slice(0, 6).map((fw, i) => ({
      id: fw.id,
      label: angles[i % angles.length] || fw.pattern.split('.')[0],
      framework: fw.id,
      example: fw.example,
      momentum: ['rising', 'steady', 'rising', 'peaking', 'steady', 'rising'][i % 6],
    })),
    sounds: [
      { id: 'narration-driven',  label: 'Direct narration with subtle bed', energy: 'medium', useCase: 'Default for authority niches' },
      { id: 'beat-cuts',         label: 'Beat-synced jump cuts',           energy: 'high',   useCase: 'Use for energy openings' },
      { id: 'ambient-foley',     label: 'Ambient + foley layering',        energy: 'low',    useCase: 'Tutorials & ASMR adjacent' },
      { id: 'trending-sound',    label: 'Trending audio at 15-20% volume', energy: 'medium', useCase: 'TikTok/Reels surface boost' },
    ],
    formats: [
      { id: 'hook-payoff',       label: 'Hook → Proof → Payoff',           length: pp.idealLength, structure: '0-2s · 2-7s · 7-end' },
      { id: 'reveal-rewind',     label: 'Reveal then Rewind',              length: pp.idealLength, structure: 'Show outcome first, then setup' },
      { id: 'list-tease',        label: 'Numbered List Tease',             length: pp.idealLength, structure: '"3 things" → 1 → 2 → 3 → CTA' },
    ],
    overlays: [
      { id: 'kinetic-caption',   label: 'Kinetic word-by-word captions',   style: 'bold-kinetic', when: 'Throughout' },
      { id: 'data-flex',         label: 'Bold-number stat reveal',         style: 'minimal',     when: '0-2s when applicable' },
      { id: 'progress-pill',     label: 'Progress pill ("Part 1/3")',      style: 'shadow',      when: 'Series content only' },
      { id: 'callout-arrow',     label: 'Hand-drawn callout arrow',        style: 'outline',     when: 'Mid-roll demonstration' },
    ],
    hashtags: {
      primary: [`#${slice.niche}`, '#fyp', '#viral'],
      niche: (np.keywords || []).slice(0, 5).map(k => `#${k.replace(/\s+/g, '').toLowerCase()}`),
      trending: ['#2026'],
    },
    engagement: { score: 72, momentum: 'steady' },
  };
}

async function composeTrendReport({ niche, platform, language = 'en' } = {}) {
  const slice = getKnowledgeSlice({ niche, platform, language, stage: 'analyze' });

  // No AI key in env → return the deterministic fallback so the UI still loads.
  if (!geminiConfigured) {
    return {
      niche: slice.niche,
      platform: slice.platform,
      language: slice.language,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      ...fallbackReport(slice),
    };
  }

  const system = buildSystemPrompt({
    persona: 'marketing-coach',
    niche: slice.niche,
    platform: slice.platform,
    language: slice.language,
    stage: 'analyze',
  });
  const prompt = [
    system,
    '',
    '── Task ──',
    `Compose a 2026-current trend report for the ${slice.niche.toUpperCase()} niche on ${slice.platform.toUpperCase()}.`,
    `Use the playbook above as ground truth — pick hooks/formats/overlays/hashtags that fit the platform's hook window (${slice.platformPlaybook.hookWindow}) and the niche voice (${slice.nichePlaybook.voice}).`,
    'For each item include a short, specific label that a creator could use as-is. Avoid generic adjectives.',
    '',
    SCHEMA_PROMPT,
  ].join('\n');

  try {
    const raw = await geminiGenerate(prompt, { temperature: 0.5, maxTokens: 1800 });
    const cleaned = (raw || '').replace(/```json\n?|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const json = start !== -1 && end !== -1 ? cleaned.slice(start, end + 1) : cleaned;
    const parsed = JSON.parse(json);
    return {
      niche: slice.niche,
      platform: slice.platform,
      language: slice.language,
      generatedAt: new Date().toISOString(),
      source: 'ai',
      ...parsed,
    };
  } catch (err) {
    logger.warn('trendComposer: AI compose failed, returning fallback', { error: err.message });
    return {
      niche: slice.niche,
      platform: slice.platform,
      language: slice.language,
      generatedAt: new Date().toISOString(),
      source: 'fallback',
      ...fallbackReport(slice),
    };
  }
}

module.exports = { composeTrendReport };
