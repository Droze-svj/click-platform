// Live Trend Service — REAL, web-grounded trends.
//
// Trends are derived from Claude's server-side web_search tool (via
// anthropicAI.generateJSONWithWeb), so what we return reflects what's actually
// trending on the platform RIGHT NOW, with source citations. Results are cached
// per (platform × niche) for 8 hours to bound cost/latency.
//
// Owner's #1 rule: NO fake "live" data. If Claude isn't configured, we return
// an honest "unavailable" result — we do NOT return the old hardcoded mock as
// if it were current. The previous `mockTrends` array has been removed.

const anthropicAI = require('../utils/anthropicAI');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const cache = require('../utils/cache');
const logger = require('./../utils/logger');

const TREND_TTL_MS = 8 * 60 * 60 * 1000; // 8h per (platform, niche)

function cacheKey(platform, niche) {
  return `live-trends:${String(platform || 'tiktok').toLowerCase()}:${String(niche || 'general').toLowerCase()}`;
}

/**
 * Normalize a model's trend payload into the structured shape the rest of the
 * app consumes: { platform, niche, sounds[], hashtags[], topics[], citations[],
 * source, capturedAt }. Each item is { label, kind, score, velocity?, metadata }.
 *
 * Defensive: accepts arrays under sounds/hashtags/topics OR a flat `trends`
 * array (which it routes by an item `kind`/`type` hint, defaulting to topic).
 * Garbage / empty input yields empty arrays — never throws, never invents.
 */
function normalizeTrends(raw, { platform, niche, citations = [], source } = {}) {
  const out = {
    platform: String(platform || 'tiktok').toLowerCase(),
    niche: niche || null,
    sounds: [],
    hashtags: [],
    topics: [],
    citations: Array.isArray(citations) ? citations : [],
    source: source || 'unknown',
    capturedAt: new Date().toISOString(),
  };
  if (!raw || typeof raw !== 'object') return out;

  const toItem = (it, kind, i) => {
    if (!it) return null;
    if (typeof it === 'string') {
      return { label: it.slice(0, 200), kind, score: Math.max(0, 100 - i), velocity: 0, metadata: null };
    }
    if (typeof it !== 'object') return null;
    const label = it.label || it.name || it.title || it.text || it.tag || it.topic || it.trend;
    if (!label) return null;
    return {
      label: String(label).slice(0, 200),
      kind,
      score: typeof it.score === 'number' ? it.score : Math.max(0, 100 - i),
      velocity: typeof it.velocity === 'number' ? it.velocity : 0,
      whyNow: typeof it.whyNow === 'string' ? it.whyNow : (typeof it.why === 'string' ? it.why : undefined),
      metadata: it.metadata || null,
    };
  };

  const collect = (arr, kind) =>
    (Array.isArray(arr) ? arr : []).map((it, i) => toItem(it, kind, i)).filter(Boolean);

  out.sounds = collect(raw.sounds, 'sound');
  out.hashtags = collect(raw.hashtags, 'hashtag');
  out.topics = collect(raw.topics, 'topic');

  // Flat `trends` fallback — route each by its own kind hint.
  if (Array.isArray(raw.trends)) {
    raw.trends.forEach((it, i) => {
      const kind = (it && (it.kind || it.type)) || 'topic';
      const item = toItem(it, kind === 'sound' || kind === 'hashtag' ? kind : 'topic', i);
      if (item) out[`${item.kind}s`].push(item);
    });
  }

  return out;
}

/**
 * Fetch REAL latest trends for a platform (+ optional niche) via Claude web
 * search. Cached 8h per (platform, niche). Returns the structured shape above.
 *
 * When Claude is unconfigured/errors AND Gemini can't help, returns an honest
 * empty result with `source: 'unavailable'` and an `error` note — callers must
 * treat this as "no live data", NOT as real trends.
 *
 * @param {string} platform
 * @param {Object} [opts] - { niche, force }
 */
async function getLatestTrends(platform = 'tiktok', opts = {}) {
  const niche = opts.niche || null;
  const key = cacheKey(platform, niche);

  if (!opts.force) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  // Claude web-search path (the only path that can produce REAL live trends).
  if (anthropicAI.isConfigured()) {
    const nicheLine = niche ? ` relevant to the ${niche} niche` : '';
    const prompt =
      `Using LIVE web search, find what is ACTUALLY trending on ${String(platform).toUpperCase()} right now` +
      `${nicheLine}. Search for current trending sounds/audio, hashtags, and topics — only include items you ` +
      `can verify from your search results. Do NOT invent or guess trends; if you cannot verify enough, return ` +
      `fewer items.\n\n` +
      `Return ONLY valid JSON:\n` +
      `{\n  "sounds": [{"label":"...","whyNow":"..."}],\n` +
      `  "hashtags": [{"label":"#...","whyNow":"..."}],\n` +
      `  "topics": [{"label":"...","whyNow":"..."}]\n}\n` +
      `Up to 5 per category. whyNow = one sentence on why it's surging NOW.`;

    try {
      const result = await anthropicAI.generateJSONWithWeb(prompt, { maxTokens: 5000, maxWebSearches: 5 });
      if (result.ok && result.data) {
        const normalized = normalizeTrends(result.data, {
          platform, niche, citations: result.citations || [], source: 'claude+web',
        });
        const hasAny = normalized.sounds.length || normalized.hashtags.length || normalized.topics.length;
        if (hasAny) {
          cache.set(key, normalized, TREND_TTL_MS);
          return normalized;
        }
        logger.warn('[liveTrends] Claude web search returned no verifiable trends', { platform, niche });
      } else {
        logger.warn('[liveTrends] Claude web search failed', { platform, niche, error: result.error });
      }
    } catch (err) {
      logger.warn('[liveTrends] Claude web search threw', { platform, niche, error: err.message });
    }
  }

  // Honest "unavailable" — we deliberately do NOT return the old hardcoded mock
  // as if it were live. An empty result tells callers there's no real data.
  const unavailable = normalizeTrends({}, { platform, niche, source: 'unavailable' });
  unavailable.error = anthropicAI.isConfigured()
    ? 'Could not verify any current trends from live web search right now.'
    : 'Live trends require Claude web search (ANTHROPIC_API_KEY). No fabricated trends are returned.';
  // Cache the empty result briefly (15m) so we don't hammer the API on repeated
  // misses, but recover quickly once it's available.
  cache.set(key, unavailable, 15 * 60 * 1000);
  return unavailable;
}

/**
 * Analyze trends and suggest a content "mold" / strategy. Claude-first (reasons
 * over the REAL trends passed in) with a Gemini fallback. Honest config error
 * when neither is available — no fabricated mold.
 *
 * @param {Array|Object} trends - real trends (e.g. from getLatestTrends)
 */
async function getTrendStrategy(trends) {
  const prompt =
    `Analyze these REAL current social trends and propose a "Script Mold" (a specific satirical, ` +
    `educational, or storytelling format) that rides them. Base everything on the trends provided — ` +
    `do not invent new trends.\n\nTRENDS:\n${JSON.stringify(trends)}\n\n` +
    `Return ONLY valid JSON:\n{\n  "mold": "Name of the mold",\n  "explanation": "Why this fits the ` +
    `current high-growth trends",\n  "keyThemes": ["theme1","theme2"],\n  "recommendedTone": "...",\n` +
    `  "pacing": { "style": "fast-cut", "avgWordDensity": 3.2, "bgmTempo": "128bpm" },\n` +
    `  "retentionHookStrategy": "A 3-second visual hook focused on X",\n  "predictedEngagement": 92\n}`;

  // Claude path.
  if (anthropicAI.isConfigured()) {
    try {
      const result = await anthropicAI.generateJSON(prompt, { maxTokens: 2000 });
      if (result.ok && result.data && result.data.mold) return result.data;
    } catch (err) {
      logger.warn('[liveTrends] getTrendStrategy Claude path failed', { error: err.message });
    }
  }

  // Gemini fallback.
  if (geminiConfigured) {
    try {
      const content = await geminiGenerate(prompt, { temperature: 0.7, maxTokens: 1200 });
      if (content) {
        const fenced = content.match(/```json\s*([\s\S]+?)```/i);
        const candidate = fenced ? fenced[1].trim() : content.trim();
        try { return JSON.parse(candidate); } catch (_) {
          const first = candidate.indexOf('{');
          const last = candidate.lastIndexOf('}');
          if (first !== -1 && last > first) return JSON.parse(candidate.slice(first, last + 1));
        }
      }
    } catch (err) {
      logger.error('[liveTrends] getTrendStrategy Gemini fallback failed', { error: err.message });
    }
  }

  // Honest failure — no fabricated mold.
  return {
    ok: false,
    error: 'Trend strategy needs Claude or Gemini configured. No fabricated strategy is returned.',
  };
}

module.exports = {
  getLatestTrends,
  getTrendStrategy,
  // exported for unit testing
  normalizeTrends,
};
