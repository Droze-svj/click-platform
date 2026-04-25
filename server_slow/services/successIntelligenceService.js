// Success Intelligence Service (Phase 12)
// Cross-references user performance data with global trends to drive hyper-personalized strategy

const liveTrendService = require('./liveTrendService');
const logger = require('../utils/logger');
const { generateContent: geminiGenerate } = require('../utils/googleAI');

/**
 * Identify successful patterns in user's previous content
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success patterns (hooks, pacing, topics)
 */
async function getUserSuccessPatterns(userId) {
  try {
    // 1. Get user's top performing videos (Preparing for Supabase integration)
    // For now, using a more structured simulation that reflects recent performance
    const patterns = {
      winningHooks: ['question', 'controversial-statement'],
      preferredPacing: 'fast-cut',
      bestPerformerTopic: 'social-media-growth',
      avgRetention: 0.68,
      avgRPM: 12.50, // revenue per 1000 views estimated
      nicheAuthorityScore: 78 // out of 100
    };

    logger.info('User success patterns synthesized', { userId, patterns });
    return patterns;
  } catch (error) {
    logger.error('Error getting success patterns', { userId, error: error.message });
    return { avgRPM: 5.0, nicheAuthorityScore: 50 };
  }
}

/**
 * Calculate financial potential based on reach and niche
 */
function calculateProjectedROI(reachRange, rpm) {
  const [min, max] = reachRange;
  return {
    minRevenue: parseFloat(((min / 1000) * rpm).toFixed(2)),
    maxRevenue: parseFloat(((max / 1000) * rpm).toFixed(2)),
    currency: 'USD'
  };
}

/**
 * Predict Success Tier for a given script configuration
 * @param {Object} scriptParams - { hooks, pacing, topic }
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { successTier, probability, confidence }
 */
async function predictViralSuccess(scriptParams, userId) {
  const userPatterns = await getUserSuccessPatterns(userId);
  const globalTrends = await liveTrendService.getLatestTrends('tiktok');

  try {
    const prompt = `Predict the viral potential and financial ROI of this video concept as of March 2026.

    Concept Topic: ${scriptParams.topic}
    Hook Variant: ${scriptParams.hook}
    Global Trends: ${JSON.stringify(globalTrends)}
    User Past Success Patterns: ${JSON.stringify(userPatterns)}

    Classify into Success Tier:
    - NICHE (Steady growth in target audience)
    - TRENDING (Potential to hit the 'For You' page)
    - VIRAL (High likelihood of broad reach)
    - BREAKOUT (Extreme growth potential)

    Respond in JSON:
    {
      "tier": "VIRAL",
      "probability": 82,
      "forecastedReach": [50000, 250000],
      "factors": ["topic alignment", "high-retained hook type"],
      "improvementTip": "Add a more controversial question in the first 2 seconds.",
      "estimatedEngagement": 9.2
    }`;

    const response = await geminiGenerate(prompt, { temperature: 0.4 });
    const result = JSON.parse(response);

    // Dynamic ROI calculation
    const roi = calculateProjectedROI(result.forecastedReach, userPatterns.avgRPM || 8.0);

    return {
      ...result,
      roi,
      confidenceScore: (userPatterns.nicheAuthorityScore + 85) / 2
    };
  } catch (error) {
    logger.error('Viral prediction failed', { error: error.message });
    return {
      tier: 'UNKNOWN',
      probability: 50,
      forecastedReach: [0, 0],
      roi: { minRevenue: 0, maxRevenue: 0 }
    };
  }
}

module.exports = {
  getUserSuccessPatterns,
  predictViralSuccess
};
