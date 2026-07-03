// Content Series Planner
// From one theme, plans a COHERENT multi-part series where each part builds on
// the last (a narrative arc) — distinct from Calendar Autofill, which makes
// independent ideas. Optionally schedules the parts, in order, as calendar
// drafts. Pure prompt/parse core + injectable AI so it is unit-testable.

const MIN_PARTS = 2;
const MAX_PARTS = 10;

function clampParts(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 5;
  return Math.max(MIN_PARTS, Math.min(MAX_PARTS, v));
}

/**
 * Pure: build the generation prompt for an N-part connected series.
 */
function buildSeriesPrompt({ theme, niche, parts, platform }) {
  const n = clampParts(parts);
  return `Plan a ${n}-part ${platform} content SERIES for the ${niche} niche on the theme: "${theme}".
This is a SERIES, not ${n} unrelated posts — each part must build on the previous one
(a clear arc: setup → development → payoff). Later parts should reference/continue earlier ones.

Return ONLY a JSON array of exactly ${n} objects, in order, each:
- part (1-based number)
- title (punchy)
- hook (the first 3 seconds)
- description (what this part covers and how it continues the series)

Rules: no invented statistics or fake citations; keep each part distinct but connected.`;
}

/**
 * Pure: normalize the model output into ordered parts [{part,title,hook,description}].
 * Accepts a JSON array (of objects or strings) or JSON embedded in prose.
 */
function shapeSeries(raw, parts) {
  const n = clampParts(parts);
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let arr = tryParse(text);
  if (!Array.isArray(arr)) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) arr = tryParse(m[0]);
  }
  if (!Array.isArray(arr)) return [];

  return arr.slice(0, n).map((x, i) => {
    const o = (x && typeof x === 'object') ? x : { title: String(x || '') };
    return {
      part: i + 1, // authoritative order, ignore any model-supplied part number
      title: (o.title ? String(o.title) : `Part ${i + 1}`).trim(),
      hook: o.hook ? String(o.hook).trim() : '',
      description: o.description ? String(o.description).trim() : '',
    };
  }).filter((p) => p.title || p.hook || p.description);
}

/**
 * Generate a series plan. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function generateSeries(input, deps) {
  const { theme, niche = 'other', parts, platform = 'tiktok' } = input || {};
  const safeTheme = deps.sanitize(theme, 400);
  if (!safeTheme || !String(safeTheme).trim()) {
    const e = new Error('theme is required'); e.statusCode = 400; throw e;
  }
  const n = clampParts(parts);
  const prompt = buildSeriesPrompt({ theme: safeTheme, niche, parts: n, platform });

  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 200 * n });
  }
  const raw = await deps.generate(prompt, { maxTokens: Math.min(2000, 250 * n), temperature: 0.85 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((raw || '').length / 4),
      taskType: 'content-series',
    });
  }

  return { theme: safeTheme, niche, platform, parts: shapeSeries(raw, n) };
}

/**
 * Map series parts → the "ideas" shape Calendar Autofill's createCalendarDrafts
 * consumes, preserving order (part 1 first).
 */
function seriesToIdeas(series, platform) {
  return (Array.isArray(series) ? series : []).map((p) => ({
    title: p.title,
    hook: p.hook,
    description: p.description,
    platform,
  }));
}

module.exports = {
  MIN_PARTS,
  MAX_PARTS,
  clampParts,
  buildSeriesPrompt,
  shapeSeries,
  generateSeries,
  seriesToIdeas,
};
