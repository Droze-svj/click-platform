const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { safeJsonParse } = require('../utils/aiHelper');
const UserPreferences = require('../models/UserPreferences');
const UserStyleProfile = require('../models/UserStyleProfile');
const logger = require('../utils/logger');
const { getClickPersonalityRules } = require('./marketingKnowledge');

/**
 * Continuous Learning Matrix — builds an editing blueprint from the user's
 * REAL performance signal.
 *
 * The real per-user performance source is `UserStyleProfile`. Its `weighted*`
 * arrays (weightedHooks, weightedColorGrades, weightedPacing, …) are populated
 * by `creatorPerformanceService.ingestPostPerformance`, which derives a
 * retention-delta signal from each published post's platform analytics
 * (ScheduledPost.analytics / VideoMetrics) and feeds it through
 * `UserStyleProfile.recordPerformance`. Each weighted counter carries a
 * `performanceScore` (EMA retention delta in [-1,1]) and `sampleSize`
 * (confidence), keyed to `userId`.
 *
 * The previous implementation queried `ContentPerformance.find({ userId })`
 * and read `retentionRate / clickThroughRate / hookStyle / colorGrade /
 * retentionDropOffSecond` — none of which exist on that model (it is keyed by
 * postId/workspaceId with `performance.*` + `scores.*` and has no `userId`).
 * So the query was always empty and the "real data" branch never fired; the
 * prompt claimed "REAL PERFORMANCE DATA" while feeding "No historical data".
 *
 * Falls back honestly to a cold-start path when the user has no weighted
 * performance signal yet.
 */

/**
 * Pure helper — builds a compact performance summary from a UserStyleProfile.
 *
 * Returns { hasRealData, summary, metrics } where:
 *   - hasRealData: true only when at least one weighted counter carries a
 *     real performance signal (sampleSize >= 1). Drives honest prompt wording.
 *   - summary: human-readable lines for the prompt.
 *   - metrics: numeric rollup persisted to historicalPerformanceMetrics.
 *
 * `performanceScore` is a retention DELTA in [-1, 1] (vs. niche benchmark), so
 * we surface it both as a raw delta and as a benchmark-relative percentage
 * point figure rather than fabricating an absolute retention number we don't
 * have.
 */
function buildPerformanceSummary(profile) {
  const empty = {
    hasRealData: false,
    summary: 'No historical performance data yet (no published posts have settled analytics for this creator).',
    metrics: { avgRetentionDelta: 0, topPerformingHooks: [], sampleSize: 0 },
  };
  if (!profile) return empty;

  // Collect every weighted counter that carries a real signal.
  const weightedFacets = [
    'weightedHooks', 'weightedColorGrades', 'weightedCaptionStyles',
    'weightedPacing', 'weightedTransitions', 'weightedVoiceTones',
    'weightedCtaCategories', 'weightedFonts', 'weightedAnimations',
    'weightedMotions', 'weightedHashtags',
  ];

  let totalSampleSize = 0;
  let weightedDeltaSum = 0; // performanceScore weighted by sampleSize
  for (const facet of weightedFacets) {
    const arr = Array.isArray(profile[facet]) ? profile[facet] : [];
    for (const c of arr) {
      const ss = c.sampleSize || 0;
      if (ss >= 1) {
        totalSampleSize += ss;
        weightedDeltaSum += (c.performanceScore || 0) * ss;
      }
    }
  }

  if (totalSampleSize === 0) return empty;

  const avgRetentionDelta = weightedDeltaSum / totalSampleSize;

  // Rank top performers per facet using the model's own scoring
  // (performanceScore × log(sampleSize+1)). Use the instance method when
  // present (real Mongoose doc); fall back to an inline ranker for plain
  // objects (lean()/tests).
  const rank = (facet, limit = 3) => {
    if (typeof profile.topPerformers === 'function') {
      return profile.topPerformers(facet, limit).filter(p => (p.sampleSize || 0) >= 1);
    }
    const arr = Array.isArray(profile[facet]) ? profile[facet] : [];
    return arr
      .filter(c => (c.sampleSize || 0) >= 1)
      .slice()
      .sort((a, b) => {
        const as = (a.performanceScore || 0) * Math.log((a.sampleSize || 0) + 1);
        const bs = (b.performanceScore || 0) * Math.log((b.sampleSize || 0) + 1);
        return bs - as;
      })
      .slice(0, limit)
      .map(c => ({ key: c.key, performanceScore: c.performanceScore || 0, sampleSize: c.sampleSize || 0 }));
  };

  const topHooks = rank('weightedHooks').map(p => p.key);
  const topGrades = rank('weightedColorGrades').map(p => p.key);
  const topPacing = rank('weightedPacing').map(p => p.key);
  const topTransitions = rank('weightedTransitions').map(p => p.key);
  const topCaptionStyles = rank('weightedCaptionStyles').map(p => p.key);

  const summary = [
    `Distinct performance signals: ${totalSampleSize} (across published posts whose analytics have settled)`,
    `Avg retention delta vs. niche benchmark: ${(avgRetentionDelta * 100).toFixed(1)} pts`,
    topHooks.length ? `Top-performing hook styles: ${topHooks.join(', ')}` : null,
    topGrades.length ? `Top-performing color grades: ${topGrades.join(', ')}` : null,
    topCaptionStyles.length ? `Top-performing caption styles: ${topCaptionStyles.join(', ')}` : null,
    topPacing.length ? `Top-performing pacing: ${topPacing.join(', ')}` : null,
    topTransitions.length ? `Top-performing transitions: ${topTransitions.join(', ')}` : null,
  ].filter(Boolean).join('\n');

  return {
    hasRealData: true,
    summary,
    metrics: {
      avgRetentionDelta: Number(avgRetentionDelta.toFixed(4)),
      topPerformingHooks: topHooks,
      sampleSize: totalSampleSize,
    },
  };
}

async function ingestAnalyticsAndScrape(userId) {
  try {
    const prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      logger.warn('[ContinuousLearning] No user preferences found', { userId });
      return null;
    }

    const niche = prefs.marketingIntelligence?.niche || 'General Business';
    const competitors = prefs.marketingIntelligence?.competitorWatchlist || [];

    // Pull REAL per-user performance from the creator's style profile. This is
    // populated from real published-post analytics by creatorPerformanceService.
    // Dev/test string ids would fail the ObjectId cast — treat as no profile.
    const isDevString = typeof userId === 'string' && /^(dev-|test-)/.test(userId);
    const profile = isDevString
      ? null
      : await UserStyleProfile.findOne({ userId }).catch(() => null);

    const { hasRealData, summary: performanceSummary, metrics } = buildPerformanceSummary(profile);

    if (!geminiConfigured) {
      logger.warn('[ContinuousLearning] Gemini not configured; skipping blueprint generation');
      return null;
    }

    // Honest wording: only claim REAL data when we actually have a signal.
    const dataHeader = hasRealData
      ? 'REAL PERFORMANCE DATA (derived from this creator\'s published-post analytics):'
      : 'PERFORMANCE DATA STATUS: No real performance history yet for this creator (cold start). Base the blueprint on the niche and CLICK best-practices only — do NOT invent metrics.';
    const dataBasis = hasRealData
      ? 'Based on this real performance data, generate precise, actionable editing rules for the AI Auto-Editor.'
      : 'No real performance data exists yet, so generate sensible niche-appropriate starting rules and clearly frame them as a cold-start baseline (not learned from this creator).';

    const systemPrompt = `You are CLICK's Autonomous Continuous Learning Engine.
Generate a "Creative Intelligence Blueprint" for this creator.

${getClickPersonalityRules(userId)}

USER NICHE: "${niche}"
TRACKED COMPETITORS: ${competitors.join(', ') || 'N/A'}

${dataHeader}
${performanceSummary}

${dataBasis}
Return ONLY valid JSON:
{
  "activeCreativeBlueprint": {
    "recommendedVfx": ["string"],
    "recommendedColorMood": "string",
    "pacingStrategy": "string",
    "captionStyle": "string",
    "rationale": "string",
    "failingPatterns": ["2-3 content patterns that consistently underperform for this creator — be specific"],
    "platformPerformanceMap": {
      "tiktok":    { "rating": "best|average|weak", "reason": "one-line rationale" },
      "instagram": { "rating": "best|average|weak", "reason": "one-line rationale" },
      "youtube":   { "rating": "best|average|weak", "reason": "one-line rationale" }
    },
    "suggestedPivot": "one-sentence style evolution recommendation based on performance trajectory",
    "contentSeriesWinners": ["2-3 topic clusters that get above-average completion for this creator"]
  },
  "historicalPerformanceMetrics": {
    "avgRetentionDelta": 0,
    "topPerformingHooks": ["string"],
    "sampleSize": 0
  }
}`;

    const raw = await geminiGenerate(systemPrompt, { temperature: 0.7, maxTokens: 1800 });
    const result = safeJsonParse(raw);

    if (!result || !result.activeCreativeBlueprint) {
      logger.warn('[ContinuousLearning] Gemini returned unparseable blueprint', { preview: String(raw || '').slice(0, 100) });
      return null;
    }

    prefs.marketingIntelligence = prefs.marketingIntelligence || {};
    // Persist the metrics we actually derived from real data (not the model's
    // free-text echo) so downstream consumers get trustworthy numbers.
    prefs.marketingIntelligence.historicalPerformanceMetrics = {
      ...prefs.marketingIntelligence.historicalPerformanceMetrics,
      ...metrics,
      hasRealData,
    };
    prefs.marketingIntelligence.activeCreativeBlueprint = result.activeCreativeBlueprint;
    prefs.marketingIntelligence.lastLearningSync = new Date();
    await prefs.save();

    logger.info('[ContinuousLearning] Blueprint synced', {
      userId,
      hasRealData,
      sampleSize: metrics.sampleSize,
    });
    return result.activeCreativeBlueprint;
  } catch (error) {
    logger.error('[ContinuousLearning] ingestAnalyticsAndScrape failed', { error: error.message });
    return null;
  }
}

async function getActiveBlueprint(userId) {
  try {
    const prefs = await UserPreferences.findOne({ userId });
    return prefs?.marketingIntelligence?.activeCreativeBlueprint || null;
  } catch (error) {
    logger.error('[ContinuousLearning] getActiveBlueprint failed', { error: error.message });
    return null;
  }
}

module.exports = { ingestAnalyticsAndScrape, getActiveBlueprint, buildPerformanceSummary };
