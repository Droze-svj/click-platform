// Keyword / SEO intelligence — the vidIQ "keyword score" built from LEGITIMATE
// signals: YouTube/Google autocomplete (real demand — what people actually type),
// an AI competition estimate, and seed relevance. The scoring is PURE; demand is
// a RELATIVE proxy from suggestion rank (HONEST: labeled estimated, never an
// absolute "search volume" we don't have). Real absolute volume comes only from
// Search Console for owned sites (searchConsoleService), merged at the route.

const logger = require('../utils/logger');
const { aiCallJson } = require('../utils/aiRouter');

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0)); }

/**
 * PURE: combine demand/competition/relevance (each 0–100) into a keyword score.
 * High demand + LOW competition + high relevance = a keyword worth targeting.
 */
function scoreKeyword(keyword, signals = {}) {
  const demand = clamp(Number(signals.demand));
  const competition = clamp(Number(signals.competition));
  const relevance = clamp(Number.isFinite(signals.relevance) ? signals.relevance : 60);
  const score = Math.round(clamp(0.5 * demand + 0.3 * (100 - competition) + 0.2 * relevance));
  const recommendation = score >= 70 ? 'target' : score >= 45 ? 'secondary' : 'long-tail';
  return {
    keyword: String(keyword || '').trim(),
    score, demand, competition, relevance, recommendation,
    source: signals.source || 'estimated',
  };
}

/** PURE: parse the Google/YouTube suggest (client=firefox) JSON: ["seed",["s1",..]]. */
function parseAutocomplete(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].map((x) => (Array.isArray(x) ? x[0] : x)).filter((s) => typeof s === 'string' && s.trim());
    }
  } catch (_) { /* not JSON */ }
  return [];
}

/** RELATIVE demand proxy from suggestion rank — top suggestion ≈ higher demand. */
function demandFromRank(rank, total) {
  if (!total || total <= 0) return 50;
  return clamp(Math.round(90 - (rank / total) * 55));
}

async function fetchAutocomplete(seed, opts = {}) {
  const fetchImpl = opts.fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!fetchImpl || !seed) return [];
  const ds = opts.platform === 'youtube' || !opts.platform ? 'yt' : '';
  const url = `https://suggestqueries.google.com/complete/search?client=firefox${ds ? `&ds=${ds}` : ''}&q=${encodeURIComponent(seed)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || 8000);
  try {
    const resp = await fetchImpl(url, { signal: controller.signal });
    const text = await resp.text();
    return parseAutocomplete(text);
  } catch (e) {
    logger.warn('[keywordIntel] autocomplete failed', { error: e.message });
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Optional AI pass: estimate competition (0–100) for candidate keywords. */
async function estimateCompetition(keywords, opts = {}) {
  if (!keywords.length) return {};
  const prompt =
    `For each keyword, estimate ranking COMPETITION on ${opts.platform || 'youtube'} as 0–100 ` +
    `(0 = wide open, 100 = saturated). Return JSON {"<keyword>": <number>, ...}.\nKeywords: ${JSON.stringify(keywords.slice(0, 20))}`;
  try {
    const r = await aiCallJson(prompt, null, { taskType: 'keyword-competition', temperature: 0.2, maxTokens: 500, userId: opts.userId });
    return r && typeof r === 'object' ? r : {};
  } catch (_) {
    return {};
  }
}

/**
 * Build scored keyword ideas for a seed. Autocomplete (real demand) + an AI
 * competition estimate (honest fallback to neutral). Returns `available:false`
 * when there's no live data — never fabricated keywords.
 */
async function getKeywordIdeas(seed, options = {}) {
  const platform = options.platform || 'youtube';
  const limit = Math.max(1, Math.min(Number(options.limit) || 15, 30));

  // The real path (external autocomplete + an AI competition call) is cached per
  // (platform, seed, limit) for 6h so identical seeds don't re-hit Google or
  // re-bill AI. Bypassed when a fetchImpl is injected (tests) or noCache is set.
  if (!options.fetchImpl && !options.noCache) {
    const cache = require('../utils/cache');
    const seedLc = String(seed || '').trim().toLowerCase();
    return cache.wrap(
      `kw:${platform}:${limit}:${seedLc}`,
      () => computeKeywordIdeas(seed, options, platform, limit),
      Number(options.ttlMs) || 6 * 60 * 60 * 1000,
    );
  }
  return computeKeywordIdeas(seed, options, platform, limit);
}

async function computeKeywordIdeas(seed, options, platform, limit) {
  const suggestions = await fetchAutocomplete(seed, options);

  const candidates = suggestions.slice(0, limit);
  const comp = options.useAi === false ? {} : await estimateCompetition([seed, ...candidates], { platform, userId: options.userId });

  const seedLc = String(seed || '').toLowerCase();
  const make = (kw, i, isSeed) => scoreKeyword(kw, {
    demand: isSeed ? 70 : demandFromRank(i, suggestions.length),
    competition: clamp(Number(comp[kw])) || 55,
    relevance: isSeed ? 100 : (kw.toLowerCase().includes(seedLc) ? 80 : 60),
    source: isSeed ? 'seed' : 'youtube_autocomplete',
  });

  let ideas = candidates.map((kw, i) => make(kw, i, false));
  if (seed) ideas.unshift(make(String(seed).trim(), 0, true));

  // dedupe + sort by score
  const seen = new Set();
  ideas = ideas.filter((x) => {
    const k = x.keyword.toLowerCase();
    if (!x.keyword || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => b.score - a.score);

  return {
    seed: String(seed || '').trim(),
    platform,
    ideas,
    total: ideas.length,
    available: ideas.length > 0,
    source: suggestions.length ? 'youtube_autocomplete' : 'none',
  };
}

module.exports = {
  scoreKeyword,
  parseAutocomplete,
  demandFromRank,
  fetchAutocomplete,
  getKeywordIdeas,
};
