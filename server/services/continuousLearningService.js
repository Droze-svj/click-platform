const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { safeJsonParse } = require('../utils/aiHelper');
const UserPreferences = require('../models/UserPreferences');
const ContentPerformance = require('../models/ContentPerformance');
const logger = require('../utils/logger');
const { getClickPersonalityRules } = require('./marketingKnowledge');

/**
 * Continuous Learning Matrix — builds an editing blueprint from the user's
 * REAL ContentPerformance analytics instead of hardcoded fictional data.
 * Falls back gracefully when no performance history exists yet.
 */
async function ingestAnalyticsAndScrape(userId) {
  try {
    const prefs = await UserPreferences.findOne({ userId });
    if (!prefs) {
      logger.warn('[ContinuousLearning] No user preferences found', { userId });
      return null;
    }

    const niche = prefs.marketingIntelligence?.niche || 'General Business';
    const competitors = prefs.marketingIntelligence?.competitorWatchlist || [];

    // Pull real performance data — up to 20 recent content records.
    const perfDocs = await ContentPerformance.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .catch(() => []);

    // Build a compact performance summary for the prompt.
    let performanceSummary = 'No historical performance data yet.';
    if (perfDocs.length > 0) {
      const avgRetention = perfDocs.reduce((s, d) => s + (d.retentionRate || 0), 0) / perfDocs.length;
      const avgCtr = perfDocs.reduce((s, d) => s + (d.clickThroughRate || 0), 0) / perfDocs.length;
      const topHooks = perfDocs
        .filter(d => d.hookStyle && (d.retentionRate || 0) >= avgRetention)
        .map(d => d.hookStyle)
        .slice(0, 3);
      const topGrades = perfDocs
        .filter(d => d.colorGrade && (d.retentionRate || 0) >= avgRetention)
        .map(d => d.colorGrade)
        .slice(0, 3);
      const dropOff = perfDocs
        .map(d => d.retentionDropOffSecond)
        .filter(Boolean)
        .sort((a, b) => a - b);
      const medianDropOff = dropOff.length ? dropOff[Math.floor(dropOff.length / 2)] : null;

      performanceSummary = [
        `Sample size: ${perfDocs.length} videos`,
        `Avg retention: ${avgRetention.toFixed(1)}%`,
        `Avg CTR: ${avgCtr.toFixed(2)}%`,
        topHooks.length ? `Top-performing hook styles: ${topHooks.join(', ')}` : null,
        topGrades.length ? `Top-performing color grades: ${topGrades.join(', ')}` : null,
        medianDropOff ? `Median retention drop-off at: ${medianDropOff}s` : null,
      ].filter(Boolean).join('\n');
    }

    if (!geminiConfigured) {
      logger.warn('[ContinuousLearning] Gemini not configured; skipping blueprint generation');
      return null;
    }

    const systemPrompt = `You are CLICK's Autonomous Continuous Learning Engine.
Generate a "Creative Intelligence Blueprint" based on REAL historical performance data for this creator.

${getClickPersonalityRules(userId)}

USER NICHE: "${niche}"
TRACKED COMPETITORS: ${competitors.join(', ') || 'N/A'}

REAL PERFORMANCE DATA:
${performanceSummary}

Based on this real data, generate precise, actionable editing rules for the AI Auto-Editor.
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
    "avgRetentionRate": 0,
    "topPerformingHooks": ["string"],
    "clickThroughRate": 0
  }
}`;

    const raw = await geminiGenerate(systemPrompt, { temperature: 0.7, maxTokens: 1800 });
    const result = safeJsonParse(raw);

    if (!result || !result.activeCreativeBlueprint) {
      logger.warn('[ContinuousLearning] Gemini returned unparseable blueprint', { preview: String(raw || '').slice(0, 100) });
      return null;
    }

    prefs.marketingIntelligence = prefs.marketingIntelligence || {};
    if (result.historicalPerformanceMetrics) {
      prefs.marketingIntelligence.historicalPerformanceMetrics = {
        ...prefs.marketingIntelligence.historicalPerformanceMetrics,
        ...result.historicalPerformanceMetrics,
      };
    }
    prefs.marketingIntelligence.activeCreativeBlueprint = result.activeCreativeBlueprint;
    prefs.marketingIntelligence.lastLearningSync = new Date();
    await prefs.save();

    logger.info('[ContinuousLearning] Blueprint synced from real data', { userId, sampleSize: perfDocs.length });
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

module.exports = { ingestAnalyticsAndScrape, getActiveBlueprint };
