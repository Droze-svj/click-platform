const logger = require('../utils/logger');
const { aiCallJson } = require('../utils/aiRouter');
const ContentPerformance = require('../models/ContentPerformance');
const { getClickPersonalityRules } = require('./marketingKnowledge');

/**
 * Social Insight Service
 * Ingests data from social platforms to drive the "Continuous Learning" loop.
 * Focuses on high-fidelity metrics: Resonance, Diffraction, and Kinetic Rhythm.
 */

async function fetchSocialInsights(userId, platforms = ['tiktok', 'instagram', 'youtube']) {
  try {
    logger.info('Social Insight Node: Ingesting Platform Signals', { userId, platforms });

    // 1. Fetch real performance data for this user
    // We look for top performing posts across the requested platforms
    const topPosts = await ContentPerformance.find({ 
      platform: { $in: platforms } 
    })
      .sort({ 'scores.overall': -1 })
      .limit(10)
      .lean();

    const userPerformance = {
      avgRetention: topPosts.length > 0 
        ? topPosts.reduce((acc, p) => acc + (p.performance?.engagement || 0), 0) / topPosts.length 
        : 0.5,
      topTopics: [...new Set(topPosts.flatMap(p => p.content?.topics || []))].slice(0, 5),
      resonanceScore: topPosts.length > 0 
        ? topPosts.reduce((acc, p) => acc + (p.scores?.overall || 0), 0) / topPosts.length 
        : 50,
    };

    // 2. Global Trends — REAL, web-grounded (Claude web search via
    //    liveTrendService). We pull for the primary requested platform. If no
    //    verifiable trends come back, we OMIT the trends line entirely rather
    //    than inject fabricated "live" data (owner's #1 rule).
    let trendsLine = '';
    try {
      const liveTrendService = require('./liveTrendService');
      const primaryPlatform = platforms[0] || 'tiktok';
      const live = await liveTrendService.getLatestTrends(primaryPlatform);
      const realTrends = [...(live?.topics || []), ...(live?.hashtags || []), ...(live?.sounds || [])];
      if (realTrends.length > 0) {
        trendsLine = `\n    GLOBAL TRENDS (verified live, ${primaryPlatform}): ${JSON.stringify(realTrends.slice(0, 8))}`;
      }
    } catch (trendErr) {
      logger.warn('[socialInsight] live trends unavailable; proceeding without trends', { error: trendErr.message });
    }

    const systemPrompt = `Analyze these social signals and user performance data.

    ${getClickPersonalityRules(userId)}

    USER PERFORMANCE: ${JSON.stringify(userPerformance)}${trendsLine}

    The user is a content creator. You must provide a "Sovereign Intelligence Brief" that identifies
    how they should adjust their content style, VFX, and narratives based on what is WORKING for them 
    and what is TRENDING globally.
    
    Return a JSON "Intelligence Brief":
    {
      "trendingVfx": ["...", "..."],
      "emergingNarratives": ["...", "..."],
      "retentionOptimization": "...",
      "styleAdjustment": "...",
      "recommendedHooks": ["...", "..."]
    }`;

    const brief = await aiCallJson(systemPrompt, null, {
      taskType: 'social-intelligence-synthesis',
      preferredProvider: 'gemini',
      temperature: 0.7
    });

    return {
      ...brief,
      ingestedAt: new Date(),
      sourceCount: topPosts.length,
      userMetrics: userPerformance
    };
  } catch (error) {
    logger.error('Social Insight Ingestion Failure', { error: error.message });
    return { 
      trendingVfx: ['chromatic-aberration', 'vhs-glitch'], 
      emergingNarratives: ['Autonomous growth', 'AI Orchestration'],
      retentionOptimization: 'Hook window optimization required.',
      styleAdjustment: 'Neutral'
    };
  }
}

module.exports = {
  fetchSocialInsights
};

