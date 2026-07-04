// Carousel / Thread Composer
// Splits ONE idea into an ordered sequence of connected slides (an IG/LinkedIn
// carousel) or posts (an X/Threads thread): slide 1 is the hook, the middle slides
// carry the payload, and the last is the CTA. Distinct from the Series Planner
// (which schedules separate content pieces over days) and Repurpose (cross-platform
// reformat of finished copy). Pure prompt/parse core + injectable AI, unit-testable.

const FORMATS = {
  thread: 'an X/Threads thread — each slide is one short post (<= ~280 chars), numbered.',
  carousel: 'an Instagram/LinkedIn carousel — each slide is one punchy on-image line + a sentence.',
};
const FORMAT_KEYS = Object.keys(FORMATS);
const DEFAULT_FORMAT = 'carousel';
const MIN_SLIDES = 3;
const MAX_SLIDES = 10;
const DEFAULT_SLIDES = 6;

function normalizeFormat(format) {
  return FORMATS[format] ? format : DEFAULT_FORMAT;
}

function clampCount(n) {
  const v = Number.parseInt(n, 10);
  if (!Number.isFinite(v)) return DEFAULT_SLIDES;
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, v));
}

/**
 * Pure: build the generation prompt for `count` ordered slides.
 */
function buildPrompt({ format, topic, count }) {
  const f = normalizeFormat(format);
  const n = clampCount(count);
  return `You are a ${f} writer. Turn ONE idea into ${FORMATS[f]}

Idea:
"""
${topic}
"""
Rules:
- Exactly ${n} slides, in order. Slide 1 is a scroll-stopping HOOK. The final slide is a clear CTA.
- Middle slides each deliver ONE concrete point that builds the argument.
- Native voice, no hashtags, no emojis spam, no "as an AI". Do NOT invent fake stats.
- Return ONLY a JSON array of ${n} strings (one per slide, in order).`;
}

/**
 * Pure: normalize the model output into [{ n, text }] (1-indexed, in order).
 * Accepts a JSON array of strings/objects, or falls back to numbered/bulleted
 * line splitting. Strips any leading "1." style numbering the model added. Caps
 * at `count`.
 */
function shapeSlides(raw, count) {
  const cap = clampCount(count);
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) parsed = tryParse(m[0]);
  }

  let items = [];
  if (Array.isArray(parsed)) {
    items = parsed.map((x) => (typeof x === 'string' ? x : (x && (x.text || x.slide)) || '')).filter(Boolean);
  } else {
    items = text.split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }

  const slides = [];
  for (const it of items) {
    const clean = String(it).replace(/^\s*(?:slide\s*)?\d+[:.)]\s*/i, '').trim();
    if (clean) slides.push({ n: slides.length + 1, text: clean });
    if (slides.length >= cap) break;
  }
  return slides;
}

/**
 * Compose slides. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function composeSlides(input, deps) {
  const { format, topic, count } = input || {};
  const safe = deps.sanitize(topic, 2000);
  if (!safe || !String(safe).trim()) {
    const e = new Error('topic is required'); e.statusCode = 400; throw e;
  }
  const n = clampCount(count);
  const prompt = buildPrompt({ format, topic: safe, count: n });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 600 });
  }
  const rawOut = await deps.generate(prompt, { maxTokens: 600, temperature: 0.8, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((rawOut || '').length / 4),
      taskType: 'carousel-composer',
    });
  }
  return { format: normalizeFormat(format), slides: shapeSlides(rawOut, n) };
}

module.exports = {
  FORMATS,
  FORMAT_KEYS,
  DEFAULT_FORMAT,
  MIN_SLIDES,
  MAX_SLIDES,
  DEFAULT_SLIDES,
  normalizeFormat,
  clampCount,
  buildPrompt,
  shapeSlides,
  composeSlides,
};
