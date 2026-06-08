// Predictive Analytics Service - ML-powered predictions for content performance

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const ScheduledPost = require('../models/ScheduledPost');
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
    const { userId } = contentData;
    if (!userId) {
      return { count: 0, avgViews: 0, avgEngagement: 0, avgReach: 0, data: [] };
    }

    // Get the user's REAL historical performance from their published posts.
    // ScheduledPost IS keyed by `userId` and carries the post-publish
    // `analytics` synced by platformAnalyticsService. The previous
    // implementation queried `ContentPerformance.find({ userId })`, but
    // ContentPerformance has no `userId` (keyed by postId/workspaceId) and its
    // metrics live under `performance.*` — so the query always returned [] and
    // the "historical" branch never fired. We read the real shape here and
    // normalise the field names (analytics.views / .engagement / .reach).
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      'analytics.lastUpdated': { $exists: true },
    })
      .sort({ postedAt: -1 })
      .limit(100)
      .select('analytics platform')
      .lean();

    // Only count posts that actually have a measured signal, so cold-start
    // users honestly fall through to the no-history branch instead of being
    // averaged against zeros.
    const measured = posts.filter(p => {
      const a = p.analytics || {};
      return (a.views || a.impressions || a.reach || a.engagement || 0) > 0;
    });

    const norm = measured.map(p => {
      const a = p.analytics || {};
      return {
        views: a.views || a.videoViews || a.impressions || 0,
        engagement: a.engagement || 0,
        reach: a.reach || a.impressions || 0,
      };
    });

    const denom = Math.max(norm.length, 1);
    const avgViews = norm.reduce((s, i) => s + i.views, 0) / denom;
    const avgEngagement = norm.reduce((s, i) => s + i.engagement, 0) / denom;
    const avgReach = norm.reduce((s, i) => s + i.reach, 0) / denom;

    return {
      count: norm.length,
      avgViews,
      avgEngagement,
      avgReach,
      data: norm,
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
        bestHour = parseInt(hour, 10);
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
 * Ingest REAL market trends via the web-grounded liveTrendService (Claude web
 * search). Returns an array of { topic, platform } plus a `trendingTopics`
 * convenience list. Owner's #1 rule: NO fabricated trends — when live data is
 * unavailable (no ANTHROPIC_API_KEY / nothing verifiable), we return an honest
 * EMPTY result with source:'unavailable', never a hardcoded mock presented as
 * current. Results are cached 24h here on top of liveTrendService's own cache.
 */
async function ingestMarketTrends() {
  try {
    const cacheKey = 'market:trends:velocity';
    const cached = await get(cacheKey);
    if (cached && Array.isArray(cached) && cached.length) {
      const out = cached.slice();
      out.trendingTopics = cached.map((t) => t.topic);
      out.lastUpdate = new Date();
      out.source = 'cache';
      return out;
    }

    const liveTrendService = require('./liveTrendService');
    const live = await liveTrendService.getLatestTrends('tiktok');
    const platform = live.platform || 'tiktok';
    const labels = [
      ...((live.topics || []).map((t) => t.label)),
      ...((live.hashtags || []).map((t) => t.label)),
    ].filter(Boolean).slice(0, 8);

    const trends = labels.map((topic) => ({ topic, platform }));
    trends.trendingTopics = labels;
    trends.lastUpdate = new Date();
    trends.source = live.source || 'unavailable';

    // Only cache REAL data (so we don't pin an honest-empty result for 24h).
    if (labels.length) await set(cacheKey, trends.map((t) => ({ topic: t.topic, platform: t.platform })), 3600 * 24);

    return trends;
  } catch (error) {
    logger.error('Error ingesting market trends', { error: error.message });
    const fallback = [];
    fallback.trendingTopics = [];
    fallback.lastUpdate = new Date();
    fallback.source = 'unavailable';
    return fallback;
  }
}

/**
 * Synchronous trend lookup for real-time services. We cannot do a live web
 * search synchronously, so this returns an HONEST empty list rather than a
 * fabricated one (owner's #1 rule). Callers already treat an empty
 * trendingTopics list as "no live data".
 */
function ingestMarketTrendsSync() {
  return {
    trendingTopics: [],
    lastUpdate: new Date(),
    source: 'unavailable',
  };
}

/**
 * Detect Cultural Emergence — REAL signals only.
 *
 * The previous implementation fabricated "emerging" signals (hardcoded keywords
 * with invented velocities) AND auto-scheduled real reposts off them. That
 * violated the owner's #1 rule (no fake data) and acted on it. We do not have a
 * verifiable low-frequency emergence detector yet, so this returns an HONEST
 * empty result and performs NO auto-scheduling. When a real detector exists it
 * can be wired here; until then we never invent signals or act on them.
 */
async function detectCulturalEmergence(/* userId */) {
  return [];
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

    const list = Array.isArray(trends)
      ? trends
      : (Array.isArray(trends?.trendingTopics) ? trends.trendingTopics.map((t) => ({ topic: t })) : []);

    const { title = '', tags = [] } = contentData;
    const combinedTokens = (title + ' ' + tags.join(' ')).toLowerCase();

    // Honest, binary on-trend signal: 50 if the content matches a CURRENT
    // (web-grounded) trending topic, else 0 (neutral). No random "market heat",
    // and no fabricated velocity number — the trend list itself is now real, and
    // when it's empty/unavailable this correctly returns 0.
    const onTrend = list.some((trend) => {
      const topic = String(trend?.topic || '').toLowerCase();
      return topic && combinedTokens.includes(topic);
    });

    return onTrend ? 50 : 0;
  } catch (error) {
    return 0; // Neutral on failure — never fabricate a score.
  }
}

/**
 * Pure helper — derive a self-correction factor from a user's REAL post
 * history. Each row is expected as { predictedReach, actualReach } where
 * `actualReach` is the platform-measured reach/impressions for a published
 * post and `predictedReach` is the model's stored prediction for that post.
 *
 * Honest behaviour:
 *   - Only rows that carry BOTH a real prediction (> 0) and a real measured
 *     actual (> 0) contribute to the ratio. We never fabricate a prediction
 *     from a score, so a post with no stored prediction is simply skipped.
 *   - Fewer than 2 comparable rows → 1.0 (neutral, "not enough real data to
 *     correct"), never a guessed multiplier.
 *   - The resulting factor is clamped to [0.5, 2.0] to prevent wild swings.
 *
 * Extracted so it can be unit-tested without Mongo/external calls.
 */
function computeCorrectionFactor(perfHistory = []) {
  const comparable = [];
  for (const perf of perfHistory) {
    const predicted = Number(perf?.predictedReach) || 0;
    const actual = Number(perf?.actualReach) || 0;
    if (predicted > 0 && actual > 0) {
      comparable.push(actual / predicted);
    }
  }

  // Need at least two real predicted-vs-actual pairs to trust a correction.
  if (comparable.length < 2) return 1.0;

  const avgCorrection = comparable.reduce((s, r) => s + r, 0) / comparable.length;
  return Math.min(2.0, Math.max(0.5, avgCorrection));
}

/**
 * Apply Algorithmic Self-Correction
 * Adjusts the view estimate by how this creator's REAL measured reach has
 * historically compared to the model's stored predictions.
 *
 * Reads from `ScheduledPost` (which IS keyed by `userId` and carries the
 * post-publish `analytics` synced by platformAnalyticsService) — NOT from
 * `ContentPerformance`, which has no `userId` field and never matched the old
 * `{ userId }` query (it is keyed by postId/workspaceId). The prediction the
 * post was launched with is read from `analytics.predictedReach` when the
 * scheduler stored one; posts with no stored prediction are skipped rather
 * than back-filled with a fabricated number, so the factor stays honest and
 * falls back to a neutral 1.0 when there's no real signal yet.
 */
async function applyAlgorithmicSelfCorrection(userId, contentData) {
  try {
    if (!userId) return 1.0;

    // Last few published posts for THIS user that have settled analytics.
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      'analytics.reach': { $gt: 0 },
    })
      .sort({ postedAt: -1 })
      .limit(5)
      .select('analytics')
      .lean();

    const perfHistory = posts.map(p => ({
      // Prediction stored at launch time (only when the scheduler set it).
      predictedReach: p.analytics?.predictedReach || 0,
      // Real platform-measured reach (falls back to impressions).
      actualReach: p.analytics?.reach || p.analytics?.impressions || 0,
    }));

    const factor = computeCorrectionFactor(perfHistory);
    if (factor !== 1.0) {
      logger.info('Algorithmic Self-Correction applied', { userId, factor });
    }
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

  // Originality: a DETERMINISTIC lexical-diversity measure derived from the
  // actual text (unique words / total words), not a random number. Short/empty
  // text yields a neutral 50 rather than a fabricated high score.
  const words = combined.split(/\s+/).filter(Boolean);
  const uniqueWords = new Set(words);
  const originalityScale = words.length >= 8
    ? Math.round((uniqueWords.size / words.length) * 100)
    : 50;

  return {
    kineticSharpness: Math.min(100, kineticSharpness),
    emotionalPolarity: Math.min(100, polarity),
    potency,
    originalityScale: Math.min(100, originalityScale),
  };
}

async function verifyTrendAlignment(niche, claims) {
  try {
    const trends = await ingestMarketTrends();
    const trendingTopicsList = trends.trendingTopics || (Array.isArray(trends) ? trends.map(t => t.topic || t) : []);
    const trendingTopics = trendingTopicsList.map(t => typeof t === 'string' ? t.toLowerCase() : String(t).toLowerCase());
    
    // No real trends to align against → honest low-confidence "not aligned"
    // rather than inventing alignment.
    if (!trendingTopics.length) {
      return claims.map((claim) => ({ claim, aligned: false, confidence: 0, note: 'No live trend data to verify against.' }));
    }

    const results = claims.map(claim => {
      // Whole-word match on meaningful tokens (≥4 chars) to avoid spurious
      // substring hits like "ai" matching "AI Productivity" for any claim.
      const tokens = claim.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
      const match = tokens.some(token => trendingTopics.some(topic => topic.split(/\s+/).includes(token)));
      return {
        claim,
        aligned: match,
        // Confidence reflects a real (web-grounded) match, not a fabricated 95.
        confidence: match ? 75 : 35,
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
  computeCorrectionFactor,
  detectNicheAndType,
  verifyTrendAlignment,
  detectCulturalEmergence
};
