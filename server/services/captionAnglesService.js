// Caption Angles
// Drafts a few full-caption options for a topic, each taking a DISTINCT angle
// (hook-led, story-led, value-led, cta-led, question-led) so the creator can pick
// or A/B test the framing that lands. Lightweight + stateless — unlike
// abVariantService (which builds persisted variants from a saved Content asset for
// scheduling/learning), this just returns drafts to copy. Pure prompt/parse core +
// injectable AI so it is unit-testable, mirroring the other feature services.

const ANGLES = {
  hook: 'Open with a scroll-stopping hook line, then deliver the payoff.',
  story: 'Tell a short first-person mini-story that lands the point.',
  value: 'Lead with a concrete, skimmable takeaway (a tip or mini-list).',
  cta: 'Build toward ONE clear call-to-action (save / follow / comment).',
  question: 'Open with a provocative question that invites replies.',
};
const ANGLE_KEYS = Object.keys(ANGLES);
const DEFAULT_ANGLE = 'hook';
const MIN_COUNT = 2;
const MAX_COUNT = 5;
const DEFAULT_COUNT = 3;

function normalizeAngle(angle) {
  return ANGLES[angle] ? angle : DEFAULT_ANGLE;
}

function clampCount(n) {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, v));
}

/** Pure: the distinct angles used for a given requested count (cycled if needed). */
function anglesForCount(count) {
  const n = clampCount(count);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(ANGLE_KEYS[i % ANGLE_KEYS.length]);
  return out;
}

/**
 * Pure: build the generation prompt for `count` distinct-angle captions.
 */
function buildPrompt({ platform, topic, count, exclude }) {
  const angles = anglesForCount(count);
  const lines = angles.map((a, i) => `${i + 1}. ${a}: ${ANGLES[a]}`).join('\n');
  const { buildAvoidBlock } = require('../utils/promptDedup');
  return `You write ${platform} captions. Draft ${angles.length} DISTINCT captions for the same topic, each using a different angle:
${lines}

Topic:
"""
${topic}
"""
Rules:
- One caption per angle, in order. Each 1-3 short sentences, native to ${platform}.
- Sound like a real creator. No hashtags, no emojis spam, no "as an AI".
- Do NOT invent fake stats, prices, or promises.
- Return ONLY a JSON array of objects: [{"angle":"hook","text":"..."}, ...].${buildAvoidBlock(exclude, 'captions')}`;
}

/**
 * Pure: normalize the model output into [{ angle, text }]. Accepts a JSON array of
 * {angle,text} (or bare strings, which get angles assigned in order), or falls
 * back to line-splitting. Dedupes by text and caps at `count`.
 */
function shapeCaptions(raw, count) {
  const cap = clampCount(count);
  const order = anglesForCount(cap);
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) parsed = tryParse(m[0]);
  }

  let rows = [];
  if (Array.isArray(parsed)) {
    rows = parsed.map((x, i) => (
      typeof x === 'string'
        ? { angle: order[i] || DEFAULT_ANGLE, text: x }
        : { angle: (x && x.angle), text: x && (x.text || x.caption), _i: i }
    ));
  } else {
    rows = text.split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
      .filter(Boolean)
      .map((t, i) => ({ angle: order[i] || DEFAULT_ANGLE, text: t }));
  }

  const seen = new Set();
  const out = [];
  rows.forEach((r, i) => {
    const body = String(r.text == null ? '' : r.text).trim();
    if (!body) return;
    const key = body.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const angle = normalizeAngle(r.angle || order[i]);
    out.push({ angle, text: body });
  });
  return out.slice(0, cap);
}

/**
 * Generate caption options. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function generateCaptions(input, deps) {
  const { platform, topic, count, exclude } = input || {};
  const safe = deps.sanitize(topic, 1500);
  if (!safe || !String(safe).trim()) {
    const e = new Error('topic is required'); e.statusCode = 400; throw e;
  }
  const n = clampCount(count);
  const prompt = buildPrompt({ platform, topic: safe, count: n, exclude });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 500 });
  }
  const rawOut = await deps.generate(prompt, { maxTokens: 500, temperature: 0.85, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((rawOut || '').length / 4),
      taskType: 'caption-angles',
    });
  }
  // Safety-net filter for any caption the model repeats despite the avoid-list.
  const { filterExcluded } = require('../utils/promptDedup');
  return { platform, captions: filterExcluded(shapeCaptions(rawOut, n), exclude) };
}

module.exports = {
  ANGLES,
  ANGLE_KEYS,
  DEFAULT_ANGLE,
  MIN_COUNT,
  MAX_COUNT,
  DEFAULT_COUNT,
  normalizeAngle,
  clampCount,
  anglesForCount,
  buildPrompt,
  shapeCaptions,
  generateCaptions,
};
