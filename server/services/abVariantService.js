// A/B Variant Service
// Automatic A/B variants with learning over time

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentRecycle = require('../models/ContentRecycle');
const logger = require('../utils/logger');

/**
 * Generate A/B variants from base asset
 */
async function generateABVariants(userId, baseContentId, options = {}) {
  try {
    const {
      variantCount = 3,
      platforms = ['twitter', 'linkedin', 'facebook'],
      variationTypes = ['headline', 'caption', 'hashtags', 'timing'],
      learningEnabled = true
    } = options;

    const baseContent = await Content.findById(baseContentId);
    if (!baseContent || baseContent.userId.toString() !== userId.toString()) {
      throw new Error('Base content not found');
    }

    const variants = [];

    for (let i = 0; i < variantCount; i++) {
      const variant = await createVariant(baseContent, i, variationTypes, platforms);
      variants.push(variant);
    }

    // Get learning data if enabled
    let learningData = null;
    if (learningEnabled) {
      learningData = await getLearningData(userId, baseContentId);
    }

    // Apply learning to variants
    if (learningData) {
      variants.forEach((variant, index) => {
        variant = applyLearning(variant, learningData, index);
      });
    }

    logger.info('A/B variants generated', { userId, baseContentId, count: variants.length });
    return {
      baseContentId,
      variants,
      learningData,
      testId: generateTestId(baseContentId)
    };
  } catch (error) {
    logger.error('Error generating A/B variants', { error: error.message, userId });
    throw error;
  }
}

/**
 * Create a single variant
 */
async function createVariant(baseContent, index, variationTypes, platforms) {
  const { generateContentVariation } = require('./contentVariationService');
  const aiService = require('./aiService');

  const variant = {
    contentId: baseContent._id,
    variantIndex: index,
    platforms: [],
    variations: {},
    metadata: {
      createdAt: new Date(),
      baseContentId: baseContent._id
    }
  };

  // Generate variations for each type
  for (const type of variationTypes) {
    switch (type) {
      case 'headline':
        variant.variations.headline = await generateHeadlineVariant(baseContent, index);
        break;
      case 'caption':
        variant.variations.caption = await generateCaptionVariant(baseContent, index);
        break;
      case 'hashtags':
        variant.variations.hashtags = await generateHashtagVariant(baseContent, index);
        break;
      case 'timing':
        variant.variations.timing = await generateTimingVariant(baseContent, index);
        break;
    }
  }

  // Create platform-specific versions
  for (const platform of platforms) {
    variant.platforms.push({
      platform,
      content: await adaptVariantForPlatform(variant, platform, baseContent)
    });
  }

  return variant;
}

/**
 * Generate headline variant
 */
async function generateHeadlineVariant(baseContent, index) {
  const aiService = require('./aiService');
  
  const prompts = [
    'Create a more engaging, curiosity-driven headline',
    'Create a benefit-focused headline',
    'Create a question-based headline',
    'Create a number/stat-based headline'
  ];

  const prompt = prompts[index % prompts.length];
  
  try {
    const result = await aiService.generateContent({
      type: 'headline',
      baseText: baseContent.title || baseContent.content?.text || '',
      prompt,
      tone: baseContent.metadata?.tone || 'professional'
    });
    return result.content || result;
  } catch (error) {
    logger.warn('Error generating headline variant', { error: error.message });
    return baseContent.title || `Variant ${index + 1}`;
  }
}

/**
 * Generate caption variant
 */
async function generateCaptionVariant(baseContent, index) {
  const aiService = require('./aiService');
  
  const styles = [
    'conversational and friendly',
    'professional and authoritative',
    'concise and punchy',
    'storytelling and narrative'
  ];

  const style = styles[index % styles.length];
  
  try {
    const result = await aiService.generateContent({
      type: 'caption',
      baseText: baseContent.content?.text || '',
      style,
      length: 'medium'
    });
    return result.content || result;
  } catch (error) {
    logger.warn('Error generating caption variant', { error: error.message });
    return baseContent.content?.text || '';
  }
}

/**
 * Generate hashtag variant
 */
async function generateHashtagVariant(baseContent, index) {
  const { generateHashtags } = require('./aiService');
  
  const strategies = [
    'trending',
    'niche',
    'broad',
    'branded'
  ];

  const strategy = strategies[index % strategies.length];
  
  try {
    const result = await generateHashtags(baseContent.content?.text || '', strategy);
    return Array.isArray(result) ? result : result.hashtags || [];
  } catch (error) {
    logger.warn('Error generating hashtag variant', { error: error.message });
    return baseContent.hashtags || [];
  }
}

/**
 * Generate timing variant
 */
async function generateTimingVariant(baseContent, index) {
  const { predictOptimalTime } = require('./smartScheduleOptimizationService');
  
  // Get optimal times for different days
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const day = days[index % days.length];
  
  try {
    const optimal = await predictOptimalTime(baseContent.userId, 'twitter', 'UTC');
    return {
      day,
      time: optimal.optimalTime || new Date(),
      confidence: optimal.confidence || 0.5
    };
  } catch (error) {
    logger.warn('Error generating timing variant', { error: error.message });
    return {
      day,
      time: new Date(),
      confidence: 0.5
    };
  }
}

/**
 * Adapt variant for platform
 */
async function adaptVariantForPlatform(variant, platform, baseContent) {
  const { adaptContentForPlatform } = require('./contentAdaptationService');
  
  const adapted = {
    platform,
    headline: variant.variations.headline || baseContent.title,
    caption: variant.variations.caption || baseContent.content?.text,
    hashtags: variant.variations.hashtags || baseContent.hashtags || [],
    images: baseContent.content?.images || [],
    videos: baseContent.content?.videos || []
  };

  // Platform-specific adaptation
  try {
    const adaptedContent = await adaptContentForPlatform(
      baseContent.userId,
      {
        ...baseContent.toObject(),
        title: adapted.headline,
        content: { text: adapted.caption }
      },
      platform
    );
    
    return {
      ...adapted,
      ...adaptedContent
    };
  } catch (error) {
    return adapted;
  }
}

/**
 * Get learning data from previous variants
 */
async function getLearningData(userId, baseContentId) {
  try {
    // Get all posts from this base content
    const posts = await ScheduledPost.find({
      userId,
      contentId: baseContentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(50)
      .lean();

    if (posts.length === 0) {
      return null;
    }

    // Analyze performance
    const analysis = {
      totalPosts: posts.length,
      avgEngagement: 0,
      bestPerforming: null,
      worstPerforming: null,
      patterns: {
        bestHeadlines: [],
        bestCaptions: [],
        bestHashtags: [],
        bestTimings: [],
        bestPlatforms: []
      }
    };

    let totalEngagement = 0;
    let bestEngagement = 0;
    let worstEngagement = Infinity;

    posts.forEach(post => {
      const engagement = post.analytics?.engagement || 0;
      totalEngagement += engagement;

      if (engagement > bestEngagement) {
        bestEngagement = engagement;
        analysis.bestPerforming = post;
      }

      if (engagement < worstEngagement) {
        worstEngagement = engagement;
        analysis.worstPerforming = post;
      }

      // Track patterns
      if (engagement > analysis.avgEngagement * 1.2) {
        if (post.content?.title) analysis.patterns.bestHeadlines.push(post.content.title);
        if (post.content?.text) analysis.patterns.bestCaptions.push(post.content.text);
        if (post.hashtags) analysis.patterns.bestHashtags.push(...post.hashtags);
        if (post.postedAt) analysis.patterns.bestTimings.push(post.postedAt);
        if (post.platform) analysis.patterns.bestPlatforms.push(post.platform);
      }
    });

    analysis.avgEngagement = totalEngagement / posts.length;

    // Get most common patterns
    analysis.patterns.bestHeadlines = getMostCommon(analysis.patterns.bestHeadlines, 3);
    analysis.patterns.bestCaptions = getMostCommon(analysis.patterns.bestCaptions, 3);
    analysis.patterns.bestHashtags = getMostCommon(analysis.patterns.bestHashtags, 10);
    analysis.patterns.bestPlatforms = getMostCommon(analysis.patterns.bestPlatforms, 3);

    return analysis;
  } catch (error) {
    logger.error('Error getting learning data', { error: error.message });
    return null;
  }
}

/**
 * Get most common items
 */
function getMostCommon(items, limit) {
  const counts = {};
  items.forEach(item => {
    counts[item] = (counts[item] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

/**
 * Apply learning to variant
 */
function applyLearning(variant, learningData, index) {
  if (!learningData || !learningData.patterns) {
    return variant;
  }

  // Apply best performing patterns
  if (learningData.patterns.bestHeadlines.length > 0 && index === 0) {
    variant.variations.headline = learningData.patterns.bestHeadlines[0];
  }

  if (learningData.patterns.bestCaptions.length > 0 && index === 0) {
    variant.variations.caption = learningData.patterns.bestCaptions[0];
  }

  if (learningData.patterns.bestHashtags.length > 0) {
    variant.variations.hashtags = learningData.patterns.bestHashtags.slice(0, 5);
  }

  // Prioritize best platforms
  if (learningData.patterns.bestPlatforms.length > 0) {
    variant.platforms = variant.platforms.filter(p => 
      learningData.patterns.bestPlatforms.includes(p.platform)
    );
  }

  variant.metadata.learningApplied = true;
  variant.metadata.learningScore = learningData.avgEngagement;

  return variant;
}

/**
 * Track A/B test results
 */
async function trackABTestResults(testId, variantResults) {
  try {
    // Store results for learning
    const testResults = {
      testId,
      variants: variantResults.map(v => ({
        variantIndex: v.variantIndex,
        platform: v.platform,
        engagement: v.engagement || 0,
        impressions: v.impressions || 0,
        clicks: v.clicks || 0,
        postedAt: v.postedAt
      })),
      winner: null,
      analyzedAt: new Date()
    };

    // Find winner
    const sorted = variantResults.sort((a, b) => 
      (b.engagement || 0) - (a.engagement || 0)
    );
    testResults.winner = sorted[0];

    // Store in database (would use a TestResults model)
    // For now, return for immediate use
    return testResults;
  } catch (error) {
    logger.error('Error tracking A/B test results', { error: error.message });
    throw error;
  }
}

/**
 * Generate test ID
 */
function generateTestId(baseContentId) {
  return `ab_${baseContentId}_${Date.now()}`;
}

/**
 * Check statistical significance of A/B test
 */
function checkStatisticalSignificance(variantResults, confidenceLevel = 0.95) {
  try {
    if (variantResults.length < 2) {
      return { significant: false, reason: 'insufficient_data' };
    }

    // Calculate engagement rates
    const variants = variantResults.map(v => ({
      ...v,
      engagementRate: (v.engagement || 0) / Math.max(v.impressions || 1, 1)
    }));

    // Sort by engagement rate
    variants.sort((a, b) => b.engagementRate - a.engagementRate);
    const winner = variants[0];
    const runnerUp = variants[1];

    // Z-test for proportions
    const n1 = winner.impressions || 1;
    const n2 = runnerUp.impressions || 1;
    const p1 = winner.engagementRate;
    const p2 = runnerUp.engagementRate;

    const p = ((winner.engagement || 0) + (runnerUp.engagement || 0)) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1/n1 + 1/n2));
    const z = (p1 - p2) / se;

    // Critical z-value for 95% confidence (two-tailed)
    const criticalZ = 1.96;
    const significant = Math.abs(z) > criticalZ;

    return {
      significant,
      zScore: z,
      confidenceLevel,
      winner: winner.variantIndex,
      improvement: ((p1 - p2) / p2) * 100,
      recommendation: significant
        ? `Variant ${winner.variantIndex} is significantly better (${((p1 - p2) / p2 * 100).toFixed(1)}% improvement)`
        : 'Need more data for statistical significance'
    };
  } catch (error) {
    logger.error('Error checking statistical significance', { error: error.message });
    return { significant: false, reason: 'calculation_error' };
  }
}

/**
 * Auto-select winner and deploy
 */
async function autoSelectWinner(testId, variantResults, options = {}) {
  try {
    const {
      requireSignificance = true,
      minImprovement = 0.1, // 10%
      autoDeploy = false
    } = options;

    // Check significance
    const significance = checkStatisticalSignificance(variantResults);

    if (requireSignificance && !significance.significant) {
      return {
        winner: null,
        deployed: false,
        reason: 'not_statistically_significant',
        significance
      };
    }

    // Check minimum improvement
    if (significance.improvement < minImprovement * 100) {
      return {
        winner: null,
        deployed: false,
        reason: 'improvement_too_small',
        improvement: significance.improvement
      };
    }

    const winner = variantResults.find(v => v.variantIndex === significance.winner);
    
    if (!winner) {
      return {
        winner: null,
        deployed: false,
        reason: 'winner_not_found'
      };
    }

    // Auto-deploy if requested
    let deployed = false;
    if (autoDeploy && winner.contentId) {
      // Mark winner as primary variant
      const Content = require('../models/Content');
      await Content.findByIdAndUpdate(winner.contentId, {
        'metadata.isWinner': true,
        'metadata.wonTest': testId,
        'metadata.wonAt': new Date()
      });
      deployed = true;
    }

    return {
      winner: significance.winner,
      deployed,
      significance,
      improvement: significance.improvement,
      recommendation: `Deploy variant ${significance.winner} - ${significance.improvement.toFixed(1)}% improvement`
    };
  } catch (error) {
    logger.error('Error auto-selecting winner', { error: error.message });
    throw error;
  }
}

/**
 * Predict variant performance
 */
async function predictVariantPerformance(baseContentId, variant, historicalData = null) {
  try {
    const baseContent = await Content.findById(baseContentId);
    if (!baseContent) {
      throw new Error('Base content not found');
    }

    // Get base performance
    const basePosts = await ScheduledPost.find({
      contentId: baseContentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(10)
      .lean();

    const baseAvgEngagement = basePosts.length > 0
      ? basePosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / basePosts.length
      : 100;

    // Predict based on variant characteristics
    let predictedEngagement = baseAvgEngagement;
    const factors = [];

    // Headline impact
    if (variant.variations.headline) {
      const headlineLength = variant.variations.headline.length;
      if (headlineLength >= 40 && headlineLength <= 60) {
        predictedEngagement *= 1.15;
        factors.push('optimal_headline_length');
      }
    }

    // Caption style impact
    if (variant.variations.caption) {
      const captionLength = variant.variations.caption.length;
      if (captionLength >= 100 && captionLength <= 200) {
        predictedEngagement *= 1.1;
        factors.push('optimal_caption_length');
      }
    }

    // Hashtag impact
    if (variant.variations.hashtags && variant.variations.hashtags.length >= 3) {
      predictedEngagement *= 1.05;
      factors.push('good_hashtag_count');
    }

    // Learning boost
    if (variant.metadata?.learningApplied) {
      const learningBoost = (variant.metadata.learningScore || 0) / baseAvgEngagement;
      if (learningBoost > 1) {
        predictedEngagement *= Math.min(learningBoost, 1.2);
        factors.push('learning_boost');
      }
    }

    return {
      predictedEngagement: Math.round(predictedEngagement),
      baseEngagement: Math.round(baseAvgEngagement),
      improvement: ((predictedEngagement - baseAvgEngagement) / baseAvgEngagement) * 100,
      confidence: 0.7, // Medium confidence for predictions
      factors
    };
  } catch (error) {
    logger.error('Error predicting variant performance', { error: error.message });
    throw error;
  }
}

/**
 * Cross-platform variant learning
 */
async function learnFromCrossPlatformVariants(userId, baseContentId) {
  try {
    // Get all variants across platforms
    const posts = await ScheduledPost.find({
      userId,
      contentId: baseContentId,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .limit(50)
      .lean();

    if (posts.length < 3) {
      return null;
    }

    // Group by platform
    const platformData = {};
    posts.forEach(post => {
      const platform = post.platform;
      if (!platformData[platform]) {
        platformData[platform] = [];
      }
      platformData[platform].push({
        engagement: post.analytics?.engagement || 0,
        impressions: post.analytics?.impressions || 1,
        headline: post.content?.title,
        caption: post.content?.text,
        hashtags: post.hashtags || []
      });
    });

    // Find best performing elements per platform
    const learnings = {};
    for (const [platform, platformPosts] of Object.entries(platformData)) {
      const sorted = platformPosts.sort((a, b) => 
        (b.engagement / b.impressions) - (a.engagement / a.impressions)
      );
      
      const topPerformer = sorted[0];
      learnings[platform] = {
        bestHeadline: topPerformer.headline,
        bestCaption: topPerformer.caption,
        bestHashtags: topPerformer.hashtags,
        avgEngagementRate: platformPosts.reduce((sum, p) => 
          sum + (p.engagement / p.impressions), 0) / platformPosts.length
      };
    }

    return learnings;
  } catch (error) {
    logger.error('Error learning from cross-platform variants', { error: error.message });
    return null;
  }
}

module.exports = {
  generateABVariants,
  trackABTestResults,
  getLearningData,
  checkStatisticalSignificance,
  autoSelectWinner,
  predictVariantPerformance,
  learnFromCrossPlatformVariants
};

