// Hook Generator
// Drafts scroll-stopping opening lines ("hooks") for a piece of content — the
// first 1–2 seconds that decide whether a viewer keeps watching/reading. Returns
// several distinct options in a chosen style (or a mix). Pure prompt/parse core +
// injectable AI so it is unit-testable, mirroring the other feature services.

// Supported hook styles + the guidance injected into the prompt.
const STYLES = {
  curiosity: 'Open a curiosity loop — tease a surprising outcome or secret without revealing it, so they must keep watching.',
  bold: 'Lead with a bold, specific claim or result that sounds almost too good (but is not a lie).',
  story: 'Drop them mid-action into a story ("I was 3 seconds from quitting when…").',
  question: 'Ask ONE provocative, specific question the target viewer desperately wants answered.',
  contrarian: 'Challenge a widely-held belief in the niche ("Stop posting daily. Here is why.").',
  mix: 'Use a VARIETY of angles across the options — curiosity, a bold claim, a story open, a provocative question, and a contrarian take.',
};
const DEFAULT_STYLE = 'mix';
const MIN_COUNT = 3;
const MAX_COUNT = 8;
const DEFAULT_COUNT = 5;

function normalizeStyle(style) {
  return STYLES[style] ? style : DEFAULT_STYLE;
}

function clampCount(n) {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_COUNT;
  return Math.min(MAX_COUNT, Math.max(MIN_COUNT, v));
}

/**
 * Pure: build the generation prompt for `count` hook options.
 */
function buildPrompt({ platform, style, topic, count }) {
  const s = normalizeStyle(style);
  const n = clampCount(count);
  return `You write scroll-stopping HOOKS — the opening line of a ${platform} post or short video.
Style: ${STYLES[s]}

Topic / content:
"""
${topic}
"""
Rules:
- Return exactly ${n} distinct hooks, each ONE short line (max ~12 words).
- Make them punchy and specific to the topic. No hashtags, no emojis, no "as an AI".
- Do NOT invent fake stats, prices, or promises.
- Return ONLY a JSON array of ${n} strings.`;
}

/**
 * Pure: normalize the model output into [{ text, style }]. Accepts a JSON array
 * of strings/objects, or falls back to splitting numbered/bulleted lines. Dedupes
 * and caps at `count`.
 */
function shapeHooks(raw, style, count) {
  const s = normalizeStyle(style);
  const cap = clampCount(count);
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (str) => { try { return JSON.parse(str); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) parsed = tryParse(m[0]);
  }

  let items = [];
  if (Array.isArray(parsed)) {
    items = parsed.map((x) => (typeof x === 'string' ? x : (x && x.text) || '')).filter(Boolean);
  } else {
    items = text.split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }

  const seen = new Set();
  const hooks = [];
  for (const t of items) {
    const clean = t.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); hooks.push({ text: clean, style: s }); }
    if (hooks.length >= cap) break;
  }
  return hooks;
}

/**
 * Generate hook options. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function generateHooks(input, deps) {
  const { platform, style, topic, count } = input || {};
  const safe = deps.sanitize(topic, 1500);
  if (!safe || !String(safe).trim()) {
    const e = new Error('topic is required'); e.statusCode = 400; throw e;
  }
  const n = clampCount(count);
  const prompt = buildPrompt({ platform, style, topic: safe, count: n });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 400 });
  }
  const raw = await deps.generate(prompt, { maxTokens: 400, temperature: 0.9, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((raw || '').length / 4),
      taskType: 'hook-generator',
    });
  }
  return { platform, style: normalizeStyle(style), hooks: shapeHooks(raw, style, n) };
}

module.exports = {
  STYLES,
  DEFAULT_STYLE,
  MIN_COUNT,
  MAX_COUNT,
  DEFAULT_COUNT,
  normalizeStyle,
  clampCount,
  buildPrompt,
  shapeHooks,
  generateHooks,
};
