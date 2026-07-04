// Hashtag Strategist
// Builds a balanced, strategic hashtag set for a topic — mixing reach tiers so a
// post isn't buried in one over-saturated pool: a few BROAD (high-volume reach),
// several NICHE (targeted intent), some COMMUNITY (engaged micro-tags), and a
// BRANDED slot. Pure prompt/parse core + injectable AI so it is unit-testable,
// mirroring the other feature services.

const TIERS = {
  broad: 'High-volume, wide-reach tags (big audience, high competition).',
  niche: 'Targeted tags for the specific topic/intent (moderate volume, better fit).',
  community: 'Small, highly-engaged community/micro tags (low volume, high intent).',
  branded: 'A branded/campaign tag the creator can own and repeat.',
};
const TIER_KEYS = Object.keys(TIERS);
const DEFAULT_TIER = 'niche';
const MIN_COUNT = 5;
const MAX_COUNT = 30;
const DEFAULT_COUNT = 15;

function normalizeTier(tier) {
  return TIERS[tier] ? tier : DEFAULT_TIER;
}

function clampCount(n) {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, v));
}

/**
 * Pure: normalize a raw tag into a canonical "#word" form, or '' if unusable.
 * Strips whitespace/punctuation, collapses internal spaces, enforces one leading #.
 */
function normalizeTag(raw) {
  if (raw == null) return '';
  let t = String(raw).trim().replace(/^#+/, '');
  // Keep letters, digits, underscore; drop spaces and other punctuation.
  t = t.replace(/[^\p{L}\p{N}_]+/gu, '');
  if (!t) return '';
  return `#${t}`;
}

/**
 * Pure: build the generation prompt.
 */
function buildPrompt({ platform, topic, count }) {
  const n = clampCount(count);
  return `You are a ${platform} hashtag strategist. Build a balanced hashtag set for this content.

Topic:
"""
${topic}
"""
Mix these tiers so reach is balanced (not all in one over-saturated pool):
- broad: ${TIERS.broad}
- niche: ${TIERS.niche}
- community: ${TIERS.community}
- branded: ${TIERS.branded}

Rules:
- Return exactly ${n} hashtags total, weighted toward niche + community.
- Each tag is a single token, no spaces, prefixed with #.
- No banned/spammy/irrelevant tags. Do NOT invent fake branded tags that imply endorsements.
- Return ONLY a JSON array of objects: [{"tag":"#example","tier":"niche"}, ...].`;
}

/**
 * Pure: normalize the model output into [{ tag, tier }]. Accepts a JSON array of
 * {tag,tier} (or strings), or falls back to line-splitting. Dedupes tags
 * case-insensitively and caps at `count`.
 */
function shapeTags(raw, count) {
  const cap = clampCount(count);
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) parsed = tryParse(m[0]);
  }

  let rows = [];
  if (Array.isArray(parsed)) {
    rows = parsed.map((x) => (
      typeof x === 'string'
        ? { tag: x, tier: DEFAULT_TIER }
        : { tag: x && (x.tag || x.hashtag || x.text), tier: x && x.tier }
    ));
  } else {
    rows = text.split(/[\n,]/)
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
      .filter(Boolean)
      .map((t) => ({ tag: t, tier: DEFAULT_TIER }));
  }

  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const tag = normalizeTag(r.tag);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ tag, tier: normalizeTier(r.tier) });
    if (out.length >= cap) break;
  }
  return out;
}

/** Pure: group a flat [{tag,tier}] list into { tier: [tag,...] } for display. */
function groupByTier(tags) {
  const groups = Object.fromEntries(TIER_KEYS.map((t) => [t, []]));
  for (const { tag, tier } of tags) {
    (groups[tier] || groups[DEFAULT_TIER]).push(tag);
  }
  return groups;
}

/**
 * Generate a hashtag set. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function generateHashtags(input, deps) {
  const { platform, topic, count } = input || {};
  const safe = deps.sanitize(topic, 1500);
  if (!safe || !String(safe).trim()) {
    const e = new Error('topic is required'); e.statusCode = 400; throw e;
  }
  const n = clampCount(count);
  const prompt = buildPrompt({ platform, topic: safe, count: n });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 500 });
  }
  const rawOut = await deps.generate(prompt, { maxTokens: 500, temperature: 0.7, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((rawOut || '').length / 4),
      taskType: 'hashtag-strategist',
    });
  }
  const tags = shapeTags(rawOut, n);
  return { platform, count: tags.length, tags, groups: groupByTier(tags) };
}

module.exports = {
  TIERS,
  TIER_KEYS,
  DEFAULT_TIER,
  MIN_COUNT,
  MAX_COUNT,
  DEFAULT_COUNT,
  normalizeTier,
  clampCount,
  normalizeTag,
  buildPrompt,
  shapeTags,
  groupByTier,
  generateHashtags,
};
