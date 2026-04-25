// Predictive Analytics Service - ML-powered predictions for content performance

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const ScheduledPost = require('../models/ScheduledPost');
const ContentPerformance = require('../models/ContentPerformance');
const { get, set } = require('./cacheService');

/**
 * Predict content performance based on historical data
 * @param {string} contentId - Content ID
 * @param {Object} contentData - Content data (title, description, type, etc.)
 * @returns {Promise<Object>} Performance predictions
 */
async function predictContentPerformance(contentId, contentData) {
  try {
    // Check cache first
    const cacheKey = `prediction:content:${contentId}`;
    const cached = await get(cacheKey);
    if (cached) {
      return cached;
    }

    logger.info('Predicting content performance', { contentId });

    // Get historical performance data
    const historicalData = await getHistoricalPerformance(contentData);

    // Generate market velocity score
    const velocityScore = await getVelocityScore(contentData);

    // 🧠 Phase 18: Spectral Resonance Synthesis
    const resonance = calculateSpectralResonance(contentData);

    // Apply algorithmic self-correction for this creator
    const correctionFactor = await applyAlgorithmicSelfCorrection(contentData.userId, contentData);

    // Calculate predictions
    const predictions = {
      estimatedViews: predictViews(contentData, historicalData, velocityScore, correctionFactor),
      estimatedEngagement: predictEngagement(contentData, historicalData, velocityScore, correctionFactor),
      estimatedReach: predictReach(contentData, historicalData, velocityScore),
      optimalPostingTime: await predictOptimalPostingTime(contentData),
      performanceScore: calculatePerformanceScore(contentData, historicalData, velocityScore, correctionFactor, resonance),
      confidence: calculateConfidence(historicalData),
      recommendations: generateRecommendations(contentData, historicalData, velocityScore),
      marketVelocity: velocityScore,
      spectralResonance: resonance
    };

    // Cache predictions (1 hour TTL)
    await set(cacheKey, predictions, 3600);

    logger.info('Content performance predicted', {
      contentId,
      estimatedViews: predictions.estimatedViews,
      performanceScore: predictions.performanceScore,
    });

    return predictions;
  } catch (error) {
    logger.error('Error predicting content performance', {
      contentId,
      error: error.message,
    });
    captureException(error, {
      tags: { service: 'predictionService', action: 'predictContentPerformance' },
    });
    throw error;
  }
}

/**
 * Get historical performance data for similar content
 */
async function getHistoricalPerformance(contentData) {
  try {
    const { userId, type, category, tags } = contentData;

    // Get user's historical content performance
    const historicalContent = await ContentPerformance.find({
      userId,
      ...(type && { 'content.type': type }),
      ...(category && { 'content.category': category }),
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Calculate averages
    const avgViews =
      historicalContent.reduce((sum, item) => sum + (item.views || 0), 0) /
      Math.max(historicalContent.length, 1);
    const avgEngagement =
      historicalContent.reduce((sum, item) => sum + (item.engagement || 0), 0) /
      Math.max(historicalContent.length, 1);
    const avgReach =
      historicalContent.reduce((sum, item) => sum + (item.reach || 0), 0) /
      Math.max(historicalContent.length, 1);

    return {
      count: historicalContent.length,
      avgViews,
      avgEngagement,
      avgReach,
      data: historicalContent,
    };
  } catch (error) {
    logger.error('Error getting historical performance', { error: error.message });
    return {
      count: 0,
      avgViews: 0,
      avgEngagement: 0,
      avgReach: 0,
      data: [],
    };
  }
}

/**
 * Predict views based on content data and historical performance
 */
function predictViews(contentData, historicalData, velocityScore = 0, correctionFactor = 1.0) {
  if (historicalData.count === 0) {
    // No historical data, use default estimates boosted by velocity
    const baseExpected = 200 + (velocityScore * 5); // Each velocity point adds 5 views
    return {
      min: Math.round(baseExpected * 0.25),
      max: Math.round(baseExpected * 2.5),
      expected: Math.round(baseExpected),
    };
  }

  const baseViews = historicalData.avgViews;
  const variance = baseViews * 0.3; // 30% variance

  // Adjust based on content type
  const typeMultiplier = {
    video: 1.5,
    article: 1.0,
    podcast: 0.8,
    transcript: 0.6,
  }[contentData.type] || 1.0;

  // Adjust based on title length (optimal: 40-60 chars)
  const titleLength = contentData.title?.length || 0;
  const titleMultiplier =
    titleLength >= 40 && titleLength <= 60 ? 1.2 : titleLength > 0 ? 1.0 : 0.8;

  // Market velocity multiplier (0.5 to 2.0 based on 0-100 score)
  const velocityMultiplier = 0.5 + (velocityScore / 100) * 1.5;

  const expected = baseViews * typeMultiplier * titleMultiplier * velocityMultiplier * correctionFactor;

  return {
    min: Math.max(0, expected - variance),
    max: expected + (variance * velocityMultiplier),
    expected: Math.round(expected),
  };
}

/**
 * Predict engagement based on content data
 */
function predictEngagement(contentData, historicalData, velocityScore = 0, correctionFactor = 1.0) {
  if (historicalData.count === 0) {
    return {
      min: 5,
      max: 50,
      expected: Math.round(20 + (velocityScore / 10)),
      rate: 0.05 + (velocityScore / 1000), 
    };
  }

  const baseEngagement = historicalData.avgEngagement;
  const baseViews = historicalData.avgViews;
  const baseEngagementRate = baseViews > 0 ? baseEngagement / baseViews : 0.05;

  // Adjust based on content quality indicators
  const hasDescription = contentData.description && contentData.description.length > 100;
  const hasTags = contentData.tags && contentData.tags.length > 0;
  
  // Velocity increases engagement rate as trending topics attract more interaction
  const velocityBonus = (velocityScore / 100) * 0.05; // Up to 5% bonus rate
  
  const qualityMultiplier = (hasDescription ? 1.1 : 1.0) * (hasTags ? 1.1 : 1.0);

  const expectedEngagement = baseEngagement * qualityMultiplier * correctionFactor;
  const expectedRate = (baseEngagementRate + velocityBonus) * qualityMultiplier;

  return {
    min: Math.max(0, expectedEngagement * 0.7),
    max: expectedEngagement * 1.5,
    expected: Math.round(expectedEngagement),
    rate: Math.min(1.0, expectedRate),
  };
}

/**
 * Predict reach based on content data
 */
function predictReach(contentData, historicalData) {
  if (historicalData.count === 0) {
    return {
      min: 30,
      max: 400,
      expected: 150,
    };
  }

  const baseReach = historicalData.avgReach;
  const variance = baseReach * 0.25;

  // Reach is typically 60-80% of views
  const viewsPrediction = predictViews(contentData, historicalData);
  const reachFromViews = viewsPrediction.expected * 0.7;

  const expected = Math.max(baseReach, reachFromViews);

  return {
    min: Math.max(0, expected - variance),
    max: expected + variance,
    expected: Math.round(expected),
  };
}

/**
 * Predict optimal posting time
 */
async function predictOptimalPostingTime(contentData) {
  try {
    const { userId, platform } = contentData;

    // Get historical posting times and performance
    const posts = await ScheduledPost.find({
      userId,
      ...(platform && { platform }),
      status: 'posted',
    })
      .sort({ scheduledTime: -1 })
      .limit(50)
      .lean();

    if (posts.length === 0) {
      // Default optimal times by platform
      const defaultTimes = {
        instagram: { hour: 11, minute: 0 }, // 11 AM
        twitter: { hour: 9, minute: 0 }, // 9 AM
        linkedin: { hour: 8, minute: 0 }, // 8 AM
        facebook: { hour: 13, minute: 0 }, // 1 PM
        tiktok: { hour: 19, minute: 0 }, // 7 PM
      };

      return defaultTimes[platform] || { hour: 12, minute: 0 };
    }

    // Analyze best performing times
    const timePerformance = {};
    posts.forEach((post) => {
      const hour = new Date(post.scheduledTime).getHours();
      const engagement = post.analytics?.engagement || 0;
      if (!timePerformance[hour]) {
        timePerformance[hour] = { total: 0, count: 0 };
      }
      timePerformance[hour].total += engagement;
      timePerformance[hour].count += 1;
    });

    // Find hour with best average engagement
    let bestHour = 12;
    let bestAvg = 0;
    Object.entries(timePerformance).forEach(([hour, data]) => {
      const avg = data.total / data.count;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestHour = parseInt(hour);
      }
    });

    return {
      hour: bestHour,
      minute: 0,
      confidence: posts.length >= 10 ? 'high' : 'medium',
    };
  } catch (error) {
    logger.error('Error predicting optimal posting time', { error: error.message });
    return { hour: 12, minute: 0, confidence: 'low' };
  }
}

/**
 * Calculate overall performance score (0-100)
 */
function calculatePerformanceScore(contentData, historicalData, velocityScore = 0, correctionFactor = 1.0, resonance = null) {
  let score = 40; // Base score
  
  // Apply Resonance Impact (0-20 points)
  if (resonance) {
    score += (resonance.potency / 100) * 20;
    // Originality Bonus/Debt
    score += resonance.originalityScale >= 80 ? 5 : (resonance.originalityScale < 30 ? -10 : 0);
  }

  // Market Velocity (The "Live-Wire" Engine Impact) (0-30 points)
  // Highly trending topics get a massive boost
  score += (velocityScore / 100) * 30;

  // Title quality (0-15 points)
  const titleLength = contentData.title?.length || 0;
  if (titleLength >= 40 && titleLength <= 60) {
    score += 15;
  } else if (titleLength > 0) {
    score += 5;
  }

  // Description quality (0-10 points)
  if (contentData.description && contentData.description.length > 100) {
    score += 10;
  } else if (contentData.description) {
    score += 5;
  }

  // Tags (0-5 points)
  if (contentData.tags && contentData.tags.length >= 3) {
    score += 5;
  }

  // Historical performance & Self-Correction (0-20 points)
  if (historicalData.count > 0) {
    const avgEngagementRate =
      historicalData.avgViews > 0
        ? (historicalData.avgEngagement / historicalData.avgViews) * correctionFactor
        : 0;
    if (avgEngagementRate > 0.15) {
      score += 20;
    } else if (avgEngagementRate > 0.08) {
      score += 15;
    } else if (avgEngagementRate > 0.04) {
      score += 10;
    } else {
      score += 5;
    }
  }

  // Content type (0-10 points)
  const typeScores = {
    video: 10,
    article: 5,
    podcast: 8,
    transcript: 3,
  };
  score += typeScores[contentData.type] || 5;

  // Final score weighted by correction factor
  // If the AI previously overestimated, this will dampen the overall score
  const finalScore = score * Math.min(1.2, correctionFactor);

  return Math.min(100, Math.max(0, Math.round(finalScore)));
}

/**
 * Calculate prediction confidence
 */
function calculateConfidence(historicalData) {
  if (historicalData.count === 0) {
    return 'low';
  }
  if (historicalData.count >= 50) {
    return 'high';
  }
  if (historicalData.count >= 20) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate recommendations for improving content
 */
function generateRecommendations(contentData, historicalData) {
  const recommendations = [];

  // Title recommendations
  const titleLength = contentData.title?.length || 0;
  if (titleLength < 40) {
    recommendations.push({
      type: 'title',
      message: 'Consider making your title longer (40-60 characters for optimal engagement)',
      priority: 'medium',
    });
  } else if (titleLength > 60) {
    recommendations.push({
      type: 'title',
      message: 'Consider shortening your title (40-60 characters is optimal)',
      priority: 'low',
    });
  }

  // Description recommendations
  if (!contentData.description || contentData.description.length < 100) {
    recommendations.push({
      type: 'description',
      message: 'Add a detailed description (100+ characters) to improve engagement',
      priority: 'high',
    });
  }

  // Tags recommendations
  if (!contentData.tags || contentData.tags.length < 3) {
    recommendations.push({
      type: 'tags',
      message: 'Add at least 3-5 relevant tags to improve discoverability',
      priority: 'high',
    });
  }

  // Posting time recommendations
  if (historicalData.count > 0 && historicalData.avgEngagement < 10) {
    recommendations.push({
      type: 'timing',
      message: 'Consider posting at different times based on your audience activity',
      priority: 'medium',
    });
  }

  return recommendations;
}

/**
 * Predict audience growth
 * @param {string} userId - User ID
 * @param {number} days - Number of days to predict
 * @returns {Promise<Object>} Growth predictions
 */
async function predictAudienceGrowth(userId, days = 30) {
  try {
    // Get historical growth data
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      'analytics.reach': { $exists: true },
    })
      .sort({ scheduledTime: -1 })
      .limit(100)
      .lean();

    if (posts.length === 0) {
      return {
        current: 0,
        predicted: 0,
        growthRate: 0,
        confidence: 'low',
      };
    }

    // Calculate average reach per post
    const avgReach =
      posts.reduce((sum, post) => sum + (post.analytics?.reach || 0), 0) / posts.length;

    // Estimate posts per day
    const daysOfData = Math.max(
      1,
      (Date.now() - new Date(posts[posts.length - 1].scheduledTime).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const postsPerDay = posts.length / daysOfData;

    // Predict growth
    const predictedReach = avgReach * postsPerDay * days;
    const growthRate = postsPerDay > 0 ? (avgReach / postsPerDay) * 100 : 0;

    return {
      current: avgReach,
      predicted: Math.round(predictedReach),
      growthRate: Math.round(growthRate * 100) / 100,
      confidence: posts.length >= 20 ? 'high' : posts.length >= 10 ? 'medium' : 'low',
    };
  } catch (error) {
    logger.error('Error predicting audience growth', { userId, error: error.message });
    throw error;
  }
}

/**
 * Ingest market trends from external APIs (TikTok, YT, IG)
 * Simulates real-time ingestion for the "Live-Wire" engine
 */
async function ingestMarketTrends() {
  try {
    logger.info('Live-Wire: Ingesting latest market trends...');
    // In a real scenario, this would call TikTok Research API, YouTube Data API, etc.
    const trends = [
      { topic: 'AI Productivity', velocity: 0.85, platform: 'tiktok' },
      { topic: 'Budget Travel', velocity: 0.92, platform: 'instagram' },
      { topic: 'Mental Health 2026', velocity: 0.78, platform: 'youtube' },
      { topic: 'SaaS Automation', velocity: 0.65, platform: 'linkedin' }
    ];

    const cacheKey = 'market:trends:velocity';
    await set(cacheKey, trends, 3600 * 24); // Cache for 24 hours
    return trends;
  } catch (error) {
    logger.error('Error ingesting market trends', { error: error.message });
    return [];
  }
}

/**
 * Synchronous trend lookup for real-time services (Phase 10)
 */
function ingestMarketTrendsSync() {
  // In a real environment, this would read from a shared memory buffer or fast local cache
  // For simulation, we return high-velocity topics
  return {
    trendingTopics: ['AI Productivity', 'SaaS Automation', 'Budget Travel', 'Mental Health 2026'],
    lastUpdate: new Date()
  };
}

/**
 * Detect Cultural Emergence (Phase 23)
 * Looks for "Low-Frequency" signals that indicate a coming trend.
 */
async function detectCulturalEmergence(userId) {
  try {
    const cacheKey = `arbitrage:resurrection:count:${new Date().toISOString().split('T')[0]}`;
    const dailyCount = await get(cacheKey) || 0;
    const RESURRECTION_CAP = 2; // User approved 1-2 per platform

    logger.info('Live-Wire: Scanning for Cultural Emergence...');
    
    // Simulate niche data ingestion
    const signals = [
      { niche: 'SaaS', keyword: 'Agentic Workflows', velocity: 0.15, threshold: 0.12 },
      { niche: 'Lifestyle', keyword: 'Neural Minimalist', velocity: 0.08, threshold: 0.10 },
      { niche: 'Finance', keyword: 'Post-Arbitrage Strategy', velocity: 0.22, threshold: 0.15 }
    ];

    const triggers = signals.filter(s => s.velocity > s.threshold);

    if (triggers.length > 0 && dailyCount < RESURRECTION_CAP) {
      logger.info('Phase 23: Cultural Emergence Detected', { triggers: triggers.map(t => t.keyword) });
      
      // Auto-trigger Resurrection
      try {
        const recycling = require('./contentRecyclingService');
        const candidates = await recycling.scoutForResurrectionCandidates(userId);
        
        if (candidates.length > 0) {
          const candidate = candidates[0];
          logger.info('Arbitrage: Deploying Legacy Resurrection', { contentId: candidate.contentId });
          
          await recycling.createRecyclingPlan(userId, candidate.originalPostId, {
            recycleType: 'exact',
            autoSchedule: true,
            repostSchedule: { frequency: 'daily', maxReposts: 1 }
          });

          await set(cacheKey, dailyCount + 1, 3600 * 24);
        }
      } catch (err) {
        logger.warn('Arbitrage: Resurrection trigger failed', { error: err.message });
      }
    }

    return triggers;
  } catch (error) {
    logger.error('Emergence detection failed', { error: error.message });
    return [];
  }
}

/**
 * Calculate velocity score for a specific content piece
 */
async function getVelocityScore(contentData) {
  try {
    const cacheKey = 'market:trends:velocity';
    let trends = await get(cacheKey);
    
    if (!trends) {
      trends = await ingestMarketTrends();
    }

    const { title = '', tags = [] } = contentData;
    const combinedTokens = (title + ' ' + tags.join(' ')).toLowerCase();

    let maxVelocity = 0;
    trends.forEach(trend => {
      if (combinedTokens.includes(trend.topic.toLowerCase())) {
        maxVelocity = Math.max(maxVelocity, trend.velocity);
      }
    });

    // If no specific trend match, return a baseline "market heat" (randomized for simulation)
    if (maxVelocity === 0) {
      maxVelocity = 0.3 + (Math.random() * 0.2); 
    }

    return Math.round(maxVelocity * 100);
  } catch (error) {
    return 40; // Default fallback
  }
}

/**
 * Apply Algorithmic Self-Correction
 * Adjusts weights based on previous prediction vs actual performance
 */
async function applyAlgorithmicSelfCorrection(userId, contentData) {
  try {
    // Look at last 5 pieces of performance data for this user
    const perfHistory = await ContentPerformance.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    if (perfHistory.length < 2) return 1.0; // Not enough data to correct

    let totalDiff = 0;
    perfHistory.forEach(perf => {
      const predicted = perf.predictedViews || perf.scores.overall * 10; // Fallback
      const actual = perf.performance.reach || perf.performance.impressions;
      
      if (predicted > 0 && actual > 0) {
        // Ratio of actual to predicted
        totalDiff += (actual / predicted);
      }
    });

    const avgCorrection = totalDiff / perfHistory.length;
    
    // Clamp the correction factor to prevent wild swings (0.5x to 2.0x)
    const factor = Math.min(2.0, Math.max(0.5, avgCorrection));
    
    logger.info('Algorithmic Self-Correction applied', { userId, factor });
    return factor;
  } catch (error) {
    return 1.0;
  }
}

/**
 * Autonomous Niche and Content Type Detection (Phase 11)
 * Uses semantic analysis to identify vertical and format.
 */
async function detectNicheAndType(contentData) {
  try {
    const { title = '', tags = [], transcription = '' } = contentData;
    const text = `${title} ${tags.join(' ')} ${transcription}`.toLowerCase();
    
    // Niche Mapping (Unlimited Expansion Pattern)
    const niches = {
      'saas': ['software', 'saas', 'automation', 'productivity', 'workflow'],
      'fitness': ['workout', 'gym', 'fitness', 'health', 'muscle', 'diet'],
      'tech': ['developer', 'coding', 'ai', 'review', 'engineering', 'hardware'],
      'finance': ['investing', 'crypto', 'stocks', 'bitcoin', 'wealth', 'budget'],
      'lifestyle': ['vlog', 'daily', 'routine', 'travel', 'fashion']
    };

    let detectedNiche = 'General';
    for (const [niche, keywords] of Object.entries(niches)) {
      if (keywords.some(k => text.includes(k))) {
        detectedNiche = niche.charAt(0).toUpperCase() + niche.slice(1);
        break;
      }
    }

    // Content Type Mapping
    let contentType = 'educational';
    if (text.includes('vlog') || text.includes('day in') || text.includes('lifestyle')) {
      contentType = 'lifestyle';
    } else if (text.includes('tutorial') || text.includes('how to') || text.includes('guide')) {
      contentType = 'tutorial';
    } else if (text.includes('short') || text.includes('quick tip')) {
      contentType = 'short-form';
    }

    return { niche: detectedNiche, type: contentType };
  } catch (error) {
    return { niche: 'General', type: 'educational' };
  }
}

/**
 * Verify Trend Alignment (Phase 12 Sovereignty)
 * Cross-references AI claims against ingested market trends.
 */
/**
 * Spectral Resonance Synthesis (Phase 18)
 * Deep analysis of hook kinetic energy vs. historical niche performance.
 */
function calculateSpectralResonance(contentData) {
  const { title = '', description = '', transcription = '' } = contentData;
  const combined = (title + ' ' + description + ' ' + transcription).toLowerCase();

  // Kinetic Score (Search for pattern-interrupt patterns)
  const kineticPatterns = ['wait for it', 'you won\'t believe', 'the secret to', 'how I got', 'stop doing', 'why you need'];
  let kineticSharpness = 0;
  kineticPatterns.forEach(p => {
    if (combined.includes(p)) kineticSharpness += 25;
  });

  // Emotional Polarity (Simulated heuristic for Phase 18)
  const highEnergyTokens = ['shocking', 'insane', 'massive', 'extreme', 'dangerous', 'hidden'];
  let polarity = 40;
  highEnergyTokens.forEach(t => {
    if (combined.includes(t)) polarity += 10;
  });

  const potency = Math.min(100, (kineticSharpness * 0.6) + (polarity * 0.4));
  
  return {
    kineticSharpness: Math.min(100, kineticSharpness),
    emotionalPolarity: Math.min(100, polarity),
    potency,
    originalityScale: 70 + (Math.random() * 20) // Heuristic for originality
  };
}

async function verifyTrendAlignment(niche, claims) {
  try {
    const trends = await ingestMarketTrends();
    const trendingTopics = trends.trendingTopics.map(t => t.toLowerCase());
    
    const results = claims.map(claim => {
      const tokens = claim.toLowerCase().split(' ');
      const match = tokens.some(token => trendingTopics.some(topic => topic.includes(token)));
      return {
        claim,
        aligned: match,
        confidence: match ? 95 : 40
      };
    });

    return results;
  } catch (error) {
    return claims.map(c => ({ claim: c, aligned: false, confidence: 50 }));
  }
}

module.exports = {
  predictContentPerformance,
  predictAudienceGrowth,
  getHistoricalPerformance,
  ingestMarketTrends,
  ingestMarketTrendsSync,
  getVelocityScore,
  applyAlgorithmicSelfCorrection,
  detectNicheAndType,
  verifyTrendAlignment,
  detectCulturalEmergence
};
