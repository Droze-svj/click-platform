const ContentPerformance = require('../models/ContentPerformance');
const ScheduledPost = require('../models/ScheduledPost');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const logger = require('../utils/logger');

const sovereignLedger = require('./sovereignLedgerService');

/**
 * Pull the top-performing ScheduledPost entries for this user as a
 * real performance dataset for the cognitive loop. Replaces the prior
 * hardcoded `revenue: 4200, engagement: 8.4` mock that made every new
 * user see the same fabricated recommendations.
 *
 * Falls through to ContentPerformance.find first (that's the legacy
 * "workspace-level analytics" table). If ContentPerformance is empty,
 * we synthesize from ScheduledPost.analytics — the source of truth
 * after a post has been synced by the platform ingestion cron.
 */
async function loadUserPerformanceData(workspaceId, userId, niche) {
  // Path 1: agency-level performance ledger.
  if (workspaceId) {
    const wsPerf = await ContentPerformance.find({
      workspaceId,
      category: 'top_performer',
    }).sort({ 'performance.revenue': -1 }).limit(10).lean();
    if (wsPerf.length > 0) return wsPerf;
  }

  // Path 2: user-level real published posts with engagement metrics.
  if (userId) {
    const userPosts = await ScheduledPost.find({
      userId: String(userId),
      status: 'posted',
      // Only count posts that platform-ingestion actually synced.
      'analytics.lastUpdated': { $exists: true },
    })
      .sort({ 'analytics.engagement': -1 })
      .limit(20)
      .lean();

    if (userPosts.length > 0) {
      return userPosts.map((p) => ({
        platform: p.platform,
        performance: {
          revenue: p.analytics?.revenue || 0,
          engagement: p.analytics?.engagementRate?.byImpressions || p.analytics?.engagement || 0,
          impressions: p.analytics?.impressions || 0,
          reach: p.analytics?.reach || 0,
        },
        scores: {
          overall: Math.round((p.analytics?.engagementRate?.byImpressions || 0) * 100),
        },
        content: {
          format: p.content?.mediaUrl ? 'video' : 'text',
          text: p.content?.text || '',
          topics: p.content?.hashtags || [],
        },
        publishedAt: p.postedAt,
      }));
    }
  }

  // Path 3: no real data at all — return empty so the caller emits a
  // graceful "publish first to get real recommendations" message.
  return [];
}

async function analyzeStrategicPivots(workspaceId, niche = 'General', opts = {}) {
  try {
    logger.info('Starting Cognitive Loop Analysis', { workspaceId, niche });

    const topPerformers = await loadUserPerformanceData(workspaceId, opts.userId || null, niche);

    // When there's NO real performance data yet, return an honest
    // "cold-start" response instead of fabricated revenue numbers. The
    // dashboard can surface this as "Publish your first 3 posts so
    // Click can learn what works for you" — that's the truthful UX.
    if (topPerformers.length === 0) {
      return {
        status: 'cold_start',
        message: `No published-post performance data yet for ${niche}. Publish your first few posts and Click will tailor recommendations to your actual results.`,
        plan: null,
        analyzedVideos: 0,
      };
    }

    // 2. Prepare data for AI analysis
    const performanceSummary = topPerformers.map(p => ({
      platform: p.platform || 'unknown',
      format: p.content?.format || 'video',
      topics: p.content?.topics || [],
      revenue: p.performance?.revenue || 0,
      engagement: p.performance?.engagement || 0,
      score: p.scores?.overall || 0
    }));

    if (!geminiConfigured) {
      return { status: 'manual', message: 'AI not configured for autonomous pivoting.' };
    }

    // 3. Ask AI for a "Strategic Pivot"
    const prompt = `Analyze this performance data for an autonomous content agency in the ${niche} niche.
Identify patterns in high-revenue content and suggest 3 "Strategic Pivots" to optimize future video creation for the ${niche} market.

Data: ${JSON.stringify(performanceSummary)}

Return a JSON object with:
- currentWins (summary of what is working specifically in the ${niche} niche)
- recommendedPivots (array of { pivot: string, reason: string, expectedImpact: string })
- suggestedToneAdjustment (specific tone for ${niche} audience)

Return only valid JSON.`;

    const content = await geminiGenerate(prompt, { maxTokens: 800 });
    const { safeJsonParse } = require('../utils/aiRouter');
    const pivotPlan = safeJsonParse(content, {}) || {};

    // 4. Record the strategic decision in the Sovereign Ledger (Blockchain-style audit)
    await sovereignLedger.recordDecision(
      'STRATEGIC_PIVOT',
      'Strategy Oracle (ora-1)',
      {
        niche,
        pivotCount: pivotPlan.recommendedPivots?.length || 0,
        suggestedTone: pivotPlan.suggestedToneAdjustment,
        highLevelStrategy: pivotPlan.currentWins
      }
    );

    logger.info('Strategic Pivot Generated & Recorded', { workspaceId, niche, ledgerState: sovereignLedger.getLedgerState() });

    return {
      status: 'active',
      plan: pivotPlan,
      analyzedVideos: topPerformers.length,
      ledger: sovereignLedger.getLedgerState()
    };
  } catch (error) {
    logger.error('Cognitive Loop failed', { error: error.message, workspaceId, niche });
    throw error;
  }
}

module.exports = {
  analyzeStrategicPivots
};
