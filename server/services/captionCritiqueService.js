// Caption Critique
// Scores a caption/script's COPY on the dimensions that decide whether it lands —
// hook strength, clarity, CTA, and value — then returns an overall score and a
// short list of prioritized, actionable fixes. This is the inverse of the caption
// generators: it critiques copy the creator already wrote. Distinct from
// seoScorecardService (which scores video packaging metadata for discoverability).
// Pure prompt/parse core + injectable AI so it is unit-testable.

const DIMENSIONS = {
  hook: 'Does the opening line stop the scroll in the first 1-2 seconds?',
  clarity: 'Is the message immediately clear and easy to follow?',
  cta: 'Is there ONE clear call-to-action or next step?',
  value: 'Does it deliver a concrete payoff (entertain, teach, or move) the audience cares about?',
};
const DIMENSION_KEYS = Object.keys(DIMENSIONS);
const MIN_SCORE = 1;
const MAX_SCORE = 10;
const MAX_SUGGESTIONS = 5;

/** Pure: clamp to an integer score in [1, 10]; non-numbers → MIN_SCORE. */
function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return MIN_SCORE;
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, v));
}

/**
 * Pure: build the critique prompt.
 */
function buildPrompt({ platform, text }) {
  const dims = DIMENSION_KEYS.map((k) => `- ${k}: ${DIMENSIONS[k]}`).join('\n');
  return `You are a blunt but constructive ${platform} copy critic. Score this post's copy.

Post:
"""
${text}
"""
Score each dimension from 1 (poor) to 10 (excellent):
${dims}

Then give an overall score (1-10) and up to ${MAX_SUGGESTIONS} SPECIFIC, actionable
fixes ranked by impact (most important first). Be concrete — quote or rewrite lines.

Return ONLY JSON:
{"scores":{"hook":0,"clarity":0,"cta":0,"value":0},"overall":0,"summary":"one line","suggestions":["...","..."]}`;
}

/**
 * Pure: normalize the model output into a stable scorecard. Every dimension is
 * present and clamped; `overall` falls back to the rounded average of dimensions
 * when missing/invalid; suggestions are trimmed, de-duped, and capped.
 */
function shapeCritique(raw) {
  const text = String(raw == null ? '' : raw).trim();
  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!parsed || typeof parsed !== 'object') parsed = {};

  const rawScores = (parsed.scores && typeof parsed.scores === 'object') ? parsed.scores : {};
  const scores = {};
  for (const k of DIMENSION_KEYS) scores[k] = clampScore(rawScores[k]);

  const avg = Math.round(DIMENSION_KEYS.reduce((s, k) => s + scores[k], 0) / DIMENSION_KEYS.length);
  const overall = Number.isFinite(Number(parsed.overall)) ? clampScore(parsed.overall) : avg;

  const seen = new Set();
  const suggestions = [];
  const rawSug = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
  for (const s of rawSug) {
    const clean = String(s == null ? '' : s).trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); suggestions.push(clean); }
    if (suggestions.length >= MAX_SUGGESTIONS) break;
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  return { scores, overall, summary, suggestions };
}

/**
 * Critique a post. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function critiquePost(input, deps) {
  const { platform, text } = input || {};
  const safe = deps.sanitize(text, 2000);
  if (!safe || !String(safe).trim()) {
    const e = new Error('text is required'); e.statusCode = 400; throw e;
  }
  const prompt = buildPrompt({ platform, text: safe });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 500 });
  }
  const rawOut = await deps.generate(prompt, { maxTokens: 500, temperature: 0.4, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((rawOut || '').length / 4),
      taskType: 'caption-critique',
    });
  }
  return { platform, ...shapeCritique(rawOut) };
}

module.exports = {
  DIMENSIONS,
  DIMENSION_KEYS,
  MIN_SCORE,
  MAX_SCORE,
  MAX_SUGGESTIONS,
  clampScore,
  buildPrompt,
  shapeCritique,
  critiquePost,
};
