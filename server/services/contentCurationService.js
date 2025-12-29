// Automated Content Curation Service
// AI-powered content discovery, scoring, and curation

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const { generateSocialContent } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Score content for curation
 */
async function scoreContentForCuration(userId, content, options = {}) {
  try {
    const {
      considerPerformance = true,
      considerRelevance = true,
      considerRecency = true,
      considerEngagement = true
    } = options;

    let score = 0;
    const factors = {
      performance: 0,
      relevance: 0,
      recency: 0,
      engagement: 0,
      quality: 0
    };

    // Performance score (0-30 points)
    if (considerPerformance) {
      const posts = await ScheduledPost.find({
        userId,
        contentId: content._id,
        status: 'posted'
      }).lean();

      if (posts.length > 0) {
        const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
        const avgEngagement = totalEngagement / posts.length;
        const maxEngagement = Math.max(...posts.map(p => p.analytics?.engagement || 0));

        // Score based on average and peak performance
        factors.performance = Math.min(30, (avgEngagement / 100) * 15 + (maxEngagement / 500) * 15);
        score += factors.performance;
      }
    }

    // Relevance score (0-25 points)
    if (considerRelevance) {
      const user = await User.findById(userId).select('niche preferences').lean();
      
      if (user) {
        let relevanceScore = 0;

        // Check category match
        if (user.niche && content.category) {
          if (content.category.toLowerCase().includes(user.niche.toLowerCase()) ||
              user.niche.toLowerCase().includes(content.category.toLowerCase())) {
            relevanceScore += 10;
          }
        }

        // Check tag matches
        if (user.preferences?.tags && content.tags) {
          const matchingTags = content.tags.filter(tag =>
            user.preferences.tags.some(prefTag =>
              tag.toLowerCase().includes(prefTag.toLowerCase()) ||
              prefTag.toLowerCase().includes(tag.toLowerCase())
            )
          );
          relevanceScore += Math.min(15, matchingTags.length * 3);
        }

        factors.relevance = Math.min(25, relevanceScore);
        score += factors.relevance;
      }
    }

    // Recency score (0-20 points)
    if (considerRecency) {
      const daysSinceCreation = (Date.now() - new Date(content.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation < 7) {
        factors.recency = 20;
      } else if (daysSinceCreation < 30) {
        factors.recency = 15;
      } else if (daysSinceCreation < 90) {
        factors.recency = 10;
      } else {
        factors.recency = Math.max(0, 5 - (daysSinceCreation - 90) / 30);
      }
      score += factors.recency;
    }

    // Engagement potential score (0-15 points)
    if (considerEngagement) {
      // Check if content has engagement potential indicators
      let engagementScore = 0;

      // Title quality
      if (content.title && content.title.length > 10 && content.title.length < 100) {
        engagementScore += 3;
      }

      // Description quality
      if (content.description && content.description.length > 50) {
        engagementScore += 3;
      }

      // Has tags
      if (content.tags && content.tags.length > 0) {
        engagementScore += 2;
      }

      // Has media
      if (content.originalFile || content.thumbnail) {
        engagementScore += 4;
      }

      // Type bonus
      if (content.type === 'video') {
        engagementScore += 3;
      }

      factors.engagement = Math.min(15, engagementScore);
      score += factors.engagement;
    }

    // Quality score (0-10 points)
    factors.quality = assessContentQuality(content);
    score += factors.quality;

    return {
      totalScore: Math.round(score * 10) / 10,
      maxScore: 100,
      percentage: Math.round((score / 100) * 100),
      factors,
      grade: getScoreGrade(score),
      recommendation: getCurationRecommendation(score, factors)
    };
  } catch (error) {
    logger.error('Error scoring content for curation', { error: error.message, userId, contentId: content._id });
    throw error;
  }
}

/**
 * Assess content quality
 */
function assessContentQuality(content) {
  let qualityScore = 0;

  // Title presence and length
  if (content.title) {
    if (content.title.length >= 10 && content.title.length <= 100) {
      qualityScore += 2;
    }
  }

  // Description quality
  if (content.description) {
    if (content.description.length >= 50) {
      qualityScore += 2;
    }
    if (content.description.length >= 200) {
      qualityScore += 1;
    }
  }

  // Tags presence
  if (content.tags && content.tags.length >= 3) {
    qualityScore += 2;
  }

  // Media presence
  if (content.originalFile || content.thumbnail) {
    qualityScore += 2;
  }

  // Status
  if (content.status === 'completed') {
    qualityScore += 1;
  }

  return Math.min(10, qualityScore);
}

/**
 * Get score grade
 */
function getScoreGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Get curation recommendation
 */
function getCurationRecommendation(score, factors) {
  if (score >= 80) {
    return 'Highly recommended for curation - excellent content';
  } else if (score >= 70) {
    return 'Recommended for curation - good content';
  } else if (score >= 60) {
    return 'Consider for curation - acceptable content';
  } else if (score >= 50) {
    return 'Low priority - needs improvement';
  } else {
    return 'Not recommended - significant improvements needed';
  }
}

/**
 * Discover content for curation
 */
async function discoverContentForCuration(userId, options = {}) {
  try {
    const {
      limit = 20,
      minScore = 60,
      platforms = null,
      contentTypes = null,
      tags = null,
      dateRange = null,
      excludeIds = []
    } = options;

    // Build query
    const query = {
      userId,
      _id: { $nin: excludeIds },
      status: { $in: ['completed', 'draft'] }
    };

    if (contentTypes && contentTypes.length > 0) {
      query.type = { $in: contentTypes };
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    if (dateRange) {
      query.createdAt = {};
      if (dateRange.start) {
        query.createdAt.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        query.createdAt.$lte = new Date(dateRange.end);
      }
    }

    // Get candidate content
    const candidates = await Content.find(query)
      .limit(limit * 3) // Get more for scoring
      .lean();

    // Score each content
    const scoredContent = await Promise.all(
      candidates.map(async (content) => {
        const score = await scoreContentForCuration(userId, content, {
          considerPerformance: true,
          considerRelevance: true,
          considerRecency: true,
          considerEngagement: true
        });

        return {
          content,
          score: score.totalScore,
          factors: score.factors,
          grade: score.grade,
          recommendation: score.recommendation
        };
      })
    );

    // Filter by minimum score and sort
    const filtered = scoredContent
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      discovered: filtered.length,
      totalScored: scoredContent.length,
      content: filtered,
      filters: {
        minScore,
        platforms,
        contentTypes,
        tags,
        dateRange
      }
    };
  } catch (error) {
    logger.error('Error discovering content for curation', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-curate content based on rules
 */
async function autoCurateContent(userId, rules) {
  try {
    const {
      minScore = 70,
      maxItems = 10,
      platforms = null,
      contentTypes = null,
      scheduleAutomatically = false,
      scheduleDate = null
    } = rules;

    // Discover content
    const discovery = await discoverContentForCuration(userId, {
      limit: maxItems,
      minScore,
      platforms,
      contentTypes
    });

    if (discovery.content.length === 0) {
      return {
        curated: 0,
        message: 'No content found matching curation criteria'
      };
    }

    // If auto-scheduling is enabled
    if (scheduleAutomatically) {
      const ScheduledPost = require('../models/ScheduledPost');
      const scheduledPosts = [];

      for (const item of discovery.content) {
        const platformsToSchedule = platforms || ['twitter', 'linkedin'];
        
        for (const platform of platformsToSchedule) {
          const scheduledPost = new ScheduledPost({
            userId,
            contentId: item.content._id,
            platform,
            scheduledTime: scheduleDate || new Date(Date.now() + 24 * 60 * 60 * 1000), // Default: tomorrow
            status: 'scheduled',
            content: {
              title: item.content.title,
              description: item.content.description,
              type: item.content.type
            }
          });

          scheduledPosts.push(scheduledPost);
        }
      }

      await ScheduledPost.insertMany(scheduledPosts);

      return {
        curated: discovery.content.length,
        scheduled: scheduledPosts.length,
        content: discovery.content.map(item => ({
          contentId: item.content._id,
          title: item.content.title,
          score: item.score,
          grade: item.grade
        }))
      };
    }

    return {
      curated: discovery.content.length,
      content: discovery.content.map(item => ({
        contentId: item.content._id,
        title: item.content.title,
        score: item.score,
        grade: item.grade,
        recommendation: item.recommendation
      }))
    };
  } catch (error) {
    logger.error('Error auto-curating content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get curation insights
 */
async function getCurationInsights(userId, period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get all content
    const allContent = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    // Score all content
    const scoredContent = await Promise.all(
      allContent.map(async (content) => {
        const score = await scoreContentForCuration(userId, content);
        return {
          contentId: content._id,
          title: content.title,
          type: content.type,
          score: score.totalScore,
          grade: score.grade,
          factors: score.factors
        };
      })
    );

    // Calculate insights
    const insights = {
      totalContent: scoredContent.length,
      averageScore: scoredContent.reduce((sum, item) => sum + item.score, 0) / scoredContent.length,
      gradeDistribution: {
        A: scoredContent.filter(item => item.grade === 'A').length,
        B: scoredContent.filter(item => item.grade === 'B').length,
        C: scoredContent.filter(item => item.grade === 'C').length,
        D: scoredContent.filter(item => item.grade === 'D').length,
        F: scoredContent.filter(item => item.grade === 'F').length
      },
      topPerformers: scoredContent
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
      needsImprovement: scoredContent
        .filter(item => item.score < 60)
        .sort((a, b) => a.score - b.score)
        .slice(0, 10),
      recommendations: generateCurationRecommendations(scoredContent)
    };

    return insights;
  } catch (error) {
    logger.error('Error getting curation insights', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate curation recommendations
 */
function generateCurationRecommendations(scoredContent) {
  const recommendations = [];

  // Check average score
  const avgScore = scoredContent.reduce((sum, item) => sum + item.score, 0) / scoredContent.length;
  if (avgScore < 60) {
    recommendations.push('Overall content quality is below average. Focus on improving content quality.');
  }

  // Check low performers
  const lowPerformers = scoredContent.filter(item => item.score < 50).length;
  if (lowPerformers > scoredContent.length * 0.3) {
    recommendations.push(`${lowPerformers} items need significant improvement. Consider reviewing and updating low-scoring content.`);
  }

  // Check missing factors
  const missingRelevance = scoredContent.filter(item => item.factors.relevance < 10).length;
  if (missingRelevance > scoredContent.length * 0.2) {
    recommendations.push('Many items lack relevance. Consider adding better tags and categories.');
  }

  const missingQuality = scoredContent.filter(item => item.factors.quality < 5).length;
  if (missingQuality > scoredContent.length * 0.2) {
    recommendations.push('Many items need quality improvements. Add descriptions, tags, and media.');
  }

  return recommendations;
}

/**
 * Batch curate content
 */
async function batchCurateContent(userId, contentIds, options = {}) {
  try {
    const {
      minScore = 60,
      autoSchedule = false,
      scheduleDate = null,
      platforms = ['twitter', 'linkedin']
    } = options;

    const content = await Content.find({
      userId,
      _id: { $in: contentIds }
    }).lean();

    if (content.length === 0) {
      return {
        curated: 0,
        message: 'No content found'
      };
    }

    // Score all content
    const scoredContent = await Promise.all(
      content.map(async (item) => {
        const score = await scoreContentForCuration(userId, item);
        return {
          content: item,
          score: score.totalScore,
          grade: score.grade,
          recommendation: score.recommendation
        };
      })
    );

    // Filter by minimum score
    const filtered = scoredContent.filter(item => item.score >= minScore);

    if (filtered.length === 0) {
      return {
        curated: 0,
        message: 'No content meets minimum score requirement'
      };
    }

    // Auto-schedule if enabled
    if (autoSchedule) {
      const ScheduledPost = require('../models/ScheduledPost');
      const scheduledPosts = [];

      for (const item of filtered) {
        for (const platform of platforms) {
          const scheduledPost = new ScheduledPost({
            userId,
            contentId: item.content._id,
            platform,
            scheduledTime: scheduleDate || new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: 'scheduled',
            content: {
              title: item.content.title,
              description: item.content.description,
              type: item.content.type
            }
          });

          scheduledPosts.push(scheduledPost);
        }
      }

      await ScheduledPost.insertMany(scheduledPosts);

      return {
        curated: filtered.length,
        scheduled: scheduledPosts.length,
        content: filtered.map(item => ({
          contentId: item.content._id,
          title: item.content.title,
          score: item.score,
          grade: item.grade
        }))
      };
    }

    return {
      curated: filtered.length,
      content: filtered.map(item => ({
        contentId: item.content._id,
        title: item.content.title,
        score: item.score,
        grade: item.grade,
        recommendation: item.recommendation
      }))
    };
  } catch (error) {
    logger.error('Error batch curating content', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get curated content feed
 */
async function getCuratedFeed(userId, options = {}) {
  try {
    const {
      limit = 20,
      minScore = 70,
      platforms = null,
      contentTypes = null,
      sortBy = 'score' // score, recency, performance
    } = options;

    const discovery = await discoverContentForCuration(userId, {
      limit,
      minScore,
      platforms,
      contentTypes
    });

    // Sort if needed
    if (sortBy === 'recency') {
      discovery.content.sort((a, b) => 
        new Date(b.content.createdAt) - new Date(a.content.createdAt)
      );
    } else if (sortBy === 'performance') {
      // Sort by performance factor
      discovery.content.sort((a, b) => 
        (b.factors.performance || 0) - (a.factors.performance || 0)
      );
    }

    return {
      feed: discovery.content,
      total: discovery.content.length,
      filters: {
        minScore,
        platforms,
        contentTypes,
        sortBy
      }
    };
  } catch (error) {
    logger.error('Error getting curated feed', { error: error.message, userId });
    throw error;
  }
}

/**
 * Detect similar content to avoid duplicates
 */
async function detectSimilarContent(userId, contentId, threshold = 0.7) {
  try {
    const Content = require('../models/Content');
    const targetContent = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!targetContent) {
      throw new Error('Content not found');
    }

    // Find similar content
    const similarQuery = {
      userId,
      _id: { $ne: contentId },
      status: { $in: ['completed', 'draft', 'published'] }
    };

    const candidates = await Content.find(similarQuery).lean();

    // Calculate similarity scores
    const similarities = candidates.map(candidate => {
      const similarity = calculateContentSimilarity(targetContent, candidate);
      return {
        content: candidate,
        similarity: Math.round(similarity * 100) / 100,
        reasons: getSimilarityReasons(targetContent, candidate)
      };
    }).filter(item => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    return {
      targetContent: {
        id: targetContent._id,
        title: targetContent.title
      },
      similarContent: similarities,
      count: similarities.length
    };
  } catch (error) {
    logger.error('Error detecting similar content', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Calculate content similarity
 */
function calculateContentSimilarity(content1, content2) {
  let similarity = 0;
  let factors = 0;

  // Title similarity
  if (content1.title && content2.title) {
    similarity += calculateTextSimilarity(content1.title, content2.title) * 0.3;
    factors += 0.3;
  }

  // Description similarity
  if (content1.description && content2.description) {
    similarity += calculateTextSimilarity(content1.description, content2.description) * 0.3;
    factors += 0.3;
  }

  // Category match
  if (content1.category && content2.category) {
    if (content1.category.toLowerCase() === content2.category.toLowerCase()) {
      similarity += 0.2;
    }
    factors += 0.2;
  }

  // Tag overlap
  if (content1.tags && content2.tags && content1.tags.length > 0 && content2.tags.length > 0) {
    const commonTags = content1.tags.filter(tag => content2.tags.includes(tag));
    const tagSimilarity = commonTags.length / Math.max(content1.tags.length, content2.tags.length);
    similarity += tagSimilarity * 0.2;
    factors += 0.2;
  }

  return factors > 0 ? similarity / factors : 0;
}

/**
 * Calculate text similarity (simple Jaccard similarity)
 */
function calculateTextSimilarity(text1, text2) {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Get similarity reasons
 */
function getSimilarityReasons(content1, content2) {
  const reasons = [];

  if (content1.category && content2.category && 
      content1.category.toLowerCase() === content2.category.toLowerCase()) {
    reasons.push('Same category');
  }

  if (content1.tags && content2.tags) {
    const commonTags = content1.tags.filter(tag => content2.tags.includes(tag));
    if (commonTags.length > 0) {
      reasons.push(`${commonTags.length} common tags`);
    }
  }

  if (content1.title && content2.title) {
    const titleSimilarity = calculateTextSimilarity(content1.title, content2.title);
    if (titleSimilarity > 0.5) {
      reasons.push('Similar titles');
    }
  }

  return reasons;
}

/**
 * Assess content freshness
 */
async function assessContentFreshness(userId, contentId) {
  try {
    const Content = require('../models/Content');
    const ScheduledPost = require('../models/ScheduledPost');

    const content = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const now = new Date();
    const createdAt = new Date(content.createdAt);
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

    // Get last post date
    const lastPost = await ScheduledPost.findOne({
      userId,
      contentId: content._id,
      status: 'posted'
    })
      .sort({ postedAt: -1 })
      .lean();

    const daysSinceLastPost = lastPost
      ? (now - new Date(lastPost.postedAt)) / (1000 * 60 * 60 * 24)
      : daysSinceCreation;

    // Calculate freshness score
    let freshnessScore = 100;
    let stalenessScore = 0;

    // Age penalty
    if (daysSinceCreation > 365) {
      stalenessScore += 50;
      freshnessScore -= 30;
    } else if (daysSinceCreation > 180) {
      stalenessScore += 30;
      freshnessScore -= 20;
    } else if (daysSinceCreation > 90) {
      stalenessScore += 15;
      freshnessScore -= 10;
    }

    // Last post penalty
    if (lastPost && daysSinceLastPost > 180) {
      stalenessScore += 20;
      freshnessScore -= 15;
    } else if (lastPost && daysSinceLastPost > 90) {
      stalenessScore += 10;
      freshnessScore -= 10;
    }

    // Engagement decay
    if (lastPost && lastPost.analytics) {
      const engagement = lastPost.analytics.engagement || 0;
      if (engagement > 0 && daysSinceLastPost > 30) {
        stalenessScore += 10;
        freshnessScore -= 5;
      }
    }

    freshnessScore = Math.max(0, Math.min(100, freshnessScore));
    stalenessScore = Math.max(0, Math.min(100, stalenessScore));

    return {
      contentId,
      title: content.title,
      daysSinceCreation: Math.round(daysSinceCreation),
      daysSinceLastPost: lastPost ? Math.round(daysSinceLastPost) : null,
      freshnessScore: Math.round(freshnessScore),
      stalenessScore: Math.round(stalenessScore),
      status: freshnessScore >= 70 ? 'fresh' : freshnessScore >= 50 ? 'aging' : 'stale',
      recommendations: generateFreshnessRecommendations(freshnessScore, daysSinceCreation, daysSinceLastPost)
    };
  } catch (error) {
    logger.error('Error assessing content freshness', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Generate freshness recommendations
 */
function generateFreshnessRecommendations(freshnessScore, daysSinceCreation, daysSinceLastPost) {
  const recommendations = [];

  if (freshnessScore < 50) {
    recommendations.push('Content is stale. Consider updating or repurposing.');
  }

  if (daysSinceLastPost && daysSinceLastPost > 90) {
    recommendations.push('Content hasn\'t been posted recently. Consider reposting with updates.');
  }

  if (daysSinceCreation > 180) {
    recommendations.push('Content is old. Consider refreshing with new information or angles.');
  }

  if (freshnessScore >= 70) {
    recommendations.push('Content is fresh. Good to curate and schedule.');
  }

  return recommendations;
}

/**
 * Analyze content gaps
 */
async function analyzeContentGaps(userId, period = 90) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const Content = require('../models/Content');
    const ScheduledPost = require('../models/ScheduledPost');

    // Get user's content
    const userContent = await Content.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    // Get user profile
    const user = await User.findById(userId).select('niche preferences').lean();

    // Analyze gaps
    const gaps = {
      contentTypes: {},
      platforms: {},
      categories: {},
      tags: {},
      timeDistribution: {},
      recommendations: []
    };

    // Content type distribution
    userContent.forEach(content => {
      gaps.contentTypes[content.type] = (gaps.contentTypes[content.type] || 0) + 1;
    });

    // Platform distribution
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
      postedAt: { $gte: startDate }
    }).lean();

    posts.forEach(post => {
      gaps.platforms[post.platform] = (gaps.platforms[post.platform] || 0) + 1;
    });

    // Category distribution
    userContent.forEach(content => {
      if (content.category) {
        gaps.categories[content.category] = (gaps.categories[content.category] || 0) + 1;
      }
    });

    // Tag distribution
    userContent.forEach(content => {
      if (content.tags) {
        content.tags.forEach(tag => {
          gaps.tags[tag] = (gaps.tags[tag] || 0) + 1;
        });
      }
    });

    // Generate recommendations
    gaps.recommendations = generateGapRecommendations(gaps, user);

    return gaps;
  } catch (error) {
    logger.error('Error analyzing content gaps', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate gap recommendations
 */
function generateGapRecommendations(gaps, user) {
  const recommendations = [];

  // Check content type diversity
  const contentTypes = Object.keys(gaps.contentTypes);
  if (contentTypes.length < 3) {
    recommendations.push('Consider diversifying content types. You\'re primarily using: ' + contentTypes.join(', '));
  }

  // Check platform diversity
  const platforms = Object.keys(gaps.platforms);
  if (platforms.length < 2) {
    recommendations.push('Consider posting to more platforms. Currently using: ' + platforms.join(', '));
  }

  // Check category coverage
  if (user && user.niche) {
    const nicheCategories = Object.keys(gaps.categories);
    if (nicheCategories.length === 0) {
      recommendations.push(`Consider creating content in your niche category: ${user.niche}`);
    }
  }

  // Check tag diversity
  const tags = Object.keys(gaps.tags);
  if (tags.length < 10) {
    recommendations.push('Consider using more diverse tags to reach broader audiences.');
  }

  return recommendations;
}

/**
 * Optimize curation scheduling
 */
async function optimizeCurationSchedule(userId, contentIds, options = {}) {
  try {
    const ScheduledPost = require('../models/ScheduledPost');
    const { getOptimalPostingTimes } = require('./contentPerformanceService');

    const {
      platforms = ['twitter', 'linkedin'],
      startDate = new Date(),
      duration = 7 // days
    } = options;

    // Get optimal posting times for each platform
    const optimalTimes = {};
    for (const platform of platforms) {
      try {
        const times = await getOptimalPostingTimes(userId, platform);
        optimalTimes[platform] = times;
      } catch (error) {
        logger.warn('Error getting optimal times', { error: error.message, platform });
        optimalTimes[platform] = null;
      }
    }

    // Score content for scheduling priority
    const Content = require('../models/Content');
    const content = await Content.find({
      userId,
      _id: { $in: contentIds }
    }).lean();

    const scoredContent = await Promise.all(
      content.map(async (item) => {
        const score = await scoreContentForCuration(userId, item);
        return {
          content: item,
          score: score.totalScore
        };
      })
    );

    // Sort by score
    scoredContent.sort((a, b) => b.score - a.score);

    // Generate schedule
    const schedule = [];
    const scheduleDate = new Date(startDate);
    let contentIndex = 0;

    for (let day = 0; day < duration && contentIndex < scoredContent.length; day++) {
      for (const platform of platforms) {
        if (contentIndex >= scoredContent.length) break;

        const item = scoredContent[contentIndex];
        const optimalTime = optimalTimes[platform];

        // Calculate scheduled time
        let scheduledTime = new Date(scheduleDate);
        scheduledTime.setDate(scheduledTime.getDate() + day);

        if (optimalTime && optimalTime.bestHours && optimalTime.bestHours.length > 0) {
          // Use optimal hour
          const hour = optimalTime.bestHours[day % optimalTime.bestHours.length];
          scheduledTime.setHours(hour, 0, 0, 0);
        } else {
          // Default to 9 AM
          scheduledTime.setHours(9 + (day % 3), 0, 0, 0);
        }

        schedule.push({
          contentId: item.content._id,
          title: item.content.title,
          platform,
          scheduledTime: scheduledTime.toISOString(),
          score: item.score,
          reason: optimalTime ? 'Optimal time' : 'Default schedule'
        });

        contentIndex++;
      }
    }

    return {
      schedule,
      totalItems: schedule.length,
      duration,
      platforms,
      optimized: Object.keys(optimalTimes).length > 0
    };
  } catch (error) {
    logger.error('Error optimizing curation schedule', { error: error.message, userId });
    throw error;
  }
}

/**
 * Predict content performance for curation
 */
async function predictCurationPerformance(userId, contentId) {
  try {
    const Content = require('../models/Content');
    const { predictPerformance } = require('./contentBenchmarkingService');
    
    const content = await Content.findOne({
      _id: contentId,
      userId
    }).lean();

    if (!content) {
      throw new Error('Content not found');
    }

    const score = await scoreContentForCuration(userId, content);
    
    // Get prediction
    const prediction = await predictPerformance(userId, contentId);

    return {
      contentId,
      curationScore: score.totalScore,
      predictedPerformance: prediction.hasPrediction ? {
        engagement: prediction.predictedEngagement,
        percentile: prediction.predictedPercentile,
        confidence: prediction.confidence
      } : null,
      recommendation: score.recommendation,
      factors: score.factors
    };
  } catch (error) {
    logger.error('Error predicting curation performance', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Cluster content for batch curation
 */
async function clusterContentForCuration(userId, contentIds, options = {}) {
  try {
    const {
      similarityThreshold = 0.6,
      maxClusters = 5
    } = options;

    const Content = require('../models/Content');
    const content = await Content.find({
      userId,
      _id: { $in: contentIds }
    }).lean();

    if (content.length === 0) {
      return { clusters: [], unclustered: [] };
    }

    // Calculate similarity matrix
    const clusters = [];
    const processed = new Set();

    content.forEach((item, idx) => {
      if (processed.has(idx)) return;

      const cluster = {
        id: clusters.length,
        items: [item],
        commonTags: item.tags || [],
        commonCategory: item.category,
        avgScore: 0
      };

      // Find similar items
      content.forEach((otherItem, otherIdx) => {
        if (idx === otherIdx || processed.has(otherIdx)) return;

        const similarity = calculateContentSimilarity(item, otherItem);
        if (similarity >= similarityThreshold) {
          cluster.items.push(otherItem);
          processed.add(otherIdx);
          
          // Merge tags
          if (otherItem.tags) {
            cluster.commonTags = [...new Set([...cluster.commonTags, ...otherItem.tags])];
          }
        }
      });

      if (cluster.items.length > 1) {
        clusters.push(cluster);
        processed.add(idx);
      }
    });

    // Score clusters
    for (const cluster of clusters) {
      const scores = await Promise.all(
        cluster.items.map(item => scoreContentForCuration(userId, item))
      );
      cluster.avgScore = scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length;
    }

    // Sort by score
    clusters.sort((a, b) => b.avgScore - a.avgScore);

    // Get unclustered items
    const unclustered = content.filter((_, idx) => !processed.has(idx));

    return {
      clusters: clusters.slice(0, maxClusters),
      unclustered: unclustered.slice(0, 10),
      totalClustered: clusters.reduce((sum, c) => sum + c.items.length, 0)
    };
  } catch (error) {
    logger.error('Error clustering content', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  scoreContentForCuration,
  discoverContentForCuration,
  autoCurateContent,
  getCurationInsights,
  batchCurateContent,
  getCuratedFeed,
  detectSimilarContent,
  assessContentFreshness,
  analyzeContentGaps,
  optimizeCurationSchedule,
  predictCurationPerformance,
  clusterContentForCuration
};

