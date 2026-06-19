// Trend-jacking quick-repurpose — turn a live trend + the creator's recent
// content into ready-to-schedule repurpose suggestions (the "jump on this trend
// with your existing clip" action competitors gate behind manual work). The
// ranking + caption/hashtag mapping is a PURE core; the orchestrator pulls real
// trends (liveTrendService, honest "unavailable" fallback) + recent Content.

const liveTrendService = require('./liveTrendService');
const Content = require('../models/Content');
const logger = require('../utils/logger');

function slug(label) {
  return String(label || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

function dedupe(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = String(x || '').toLowerCase();
    if (x && !seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

// Pull whatever hashtags a Content doc already carries, wherever they live.
function extractHashtags(content) {
  if (!content) return [];
  const buckets = [
    content.hashtags,
    content.metadata && content.metadata.hashtags,
    Array.isArray(content.variants) ? content.variants.flatMap((v) => v && v.hashtags) : null,
  ];
  return dedupe(buckets.flat().filter((t) => typeof t === 'string' && t.trim()));
}

function buildCaption(trend, src) {
  const titlePart = src && src.title ? `${String(src.title).slice(0, 80)} — ` : '';
  if (trend.kind === 'sound') return `${titlePart}set to the trending sound “${trend.label}” 🔊`;
  const why = trend.whyNow ? ` (${String(trend.whyNow).slice(0, 120)})` : '';
  return `${titlePart}riding the ${trend.label} trend${why} 🚀`;
}

/**
 * PURE: rank a normalized trends object's items by relevance (score+velocity),
 * match each to one of the creator's recent content items, and emit a repurpose
 * suggestion (target platform, draft caption, merged hashtags).
 *   → { platform, suggestions:[{trend,kind,relevanceScore,whyNow,sourceContentId,
 *        sourceTitle,platform,suggestedCaption,suggestedHashtags}], total, reason? }
 */
function buildTrendRepurposePlan(recentContent = [], trends = {}, options = {}) {
  const maxSuggestions = Math.max(1, Number(options.maxSuggestions) || 5);
  const platform = (trends && trends.platform) || 'tiktok';

  const items = []
    .concat(trends.hashtags || [], trends.topics || [], trends.sounds || [])
    .filter((t) => t && t.label)
    .map((t) => ({
      label: String(t.label),
      kind: t.kind || 'topic',
      whyNow: t.whyNow || null,
      relevance: Math.round((0.6 * (Number(t.score) || 0) + 0.4 * (Number(t.velocity) || 0)) * 10) / 10,
    }))
    .sort((a, b) => b.relevance - a.relevance);

  const content = (Array.isArray(recentContent) ? recentContent : []).filter(Boolean);
  if (!items.length) return { platform, suggestions: [], total: 0, reason: 'no_trends' };
  if (!content.length) return { platform, suggestions: [], total: 0, reason: 'no_content' };

  const suggestions = items.slice(0, maxSuggestions).map((trend, i) => {
    const src = content[i % content.length];
    const trendTag = trend.kind === 'hashtag' ? trend.label : `#${slug(trend.label)}`;
    const hashtags = dedupe([trendTag, ...extractHashtags(src)]).slice(0, 8);
    return {
      trend: trend.label,
      kind: trend.kind,
      relevanceScore: trend.relevance,
      whyNow: trend.whyNow,
      sourceContentId: (src._id || src.id || null) && String(src._id || src.id),
      sourceTitle: src.title || null,
      platform,
      suggestedCaption: buildCaption(trend, src),
      suggestedHashtags: hashtags,
    };
  });

  return { platform, suggestions, total: suggestions.length };
}

/**
 * Orchestrator: fetch REAL trends for the platform/niche + the creator's recent
 * completed content, then build the repurpose plan. Returns `available:false`
 * (never fabricated trends) when live data is unavailable.
 */
async function getRepurposeSuggestions(userId, opts = {}) {
  const { platform = 'tiktok', niche, limit = 5, tier } = opts;
  let trends = null;
  try {
    trends = await liveTrendService.getLatestTrends(platform, { niche, tier });
  } catch (err) {
    logger.warn('[trendJack] trend fetch failed', { error: err.message });
  }
  if (!trends || trends.source === 'unavailable') {
    return { platform, suggestions: [], total: 0, available: false, reason: 'trends_unavailable' };
  }

  const recent = await Content.find({ userId, status: 'completed' })
    .select('_id title metadata hashtags variants')
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()
    .catch(() => []);

  const plan = buildTrendRepurposePlan(recent, trends, { maxSuggestions: limit });
  return { ...plan, available: true };
}

module.exports = { buildTrendRepurposePlan, getRepurposeSuggestions };
