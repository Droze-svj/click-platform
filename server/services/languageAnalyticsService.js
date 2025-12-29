// Language Analytics Service
// Analyzes content performance by language

const ContentTranslation = require('../models/ContentTranslation');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Get language performance analytics
 */
async function getLanguagePerformance(userId, options = {}) {
  try {
    const {
      period = 30,
      platforms = null,
      languages = null
    } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    // Get all translations for user
    const translationQuery = { userId };
    if (languages && languages.length > 0) {
      translationQuery.language = { $in: languages.map(l => l.toUpperCase()) };
    }

    const translations = await ContentTranslation.find(translationQuery).lean();

    // Get posts with translations
    const contentIds = [...new Set(translations.map(t => t.contentId.toString()))];
    
    const postQuery = {
      userId,
      contentId: { $in: contentIds },
      status: 'posted',
      postedAt: { $gte: startDate }
    };

    if (platforms && platforms.length > 0) {
      postQuery.platform = { $in: platforms };
    }

    const posts = await ScheduledPost.find(postQuery)
      .populate('contentId')
      .lean();

    // Analyze performance by language
    const languageStats = {};

    for (const translation of translations) {
      const lang = translation.language.toLowerCase();
      
      if (!languageStats[lang]) {
        languageStats[lang] = {
          language: lang,
          contentCount: 0,
          postCount: 0,
          totalEngagement: 0,
          totalViews: 0,
          totalImpressions: 0,
          averageEngagement: 0,
          averageEngagementRate: 0,
          posts: []
        };
      }

      // Find posts for this content
      const contentPosts = posts.filter(p => 
        p.contentId && p.contentId._id.toString() === translation.contentId.toString()
      );

      languageStats[lang].contentCount++;
      languageStats[lang].postCount += contentPosts.length;

      contentPosts.forEach(post => {
        const engagement = post.analytics?.engagement || 0;
        const views = post.analytics?.views || post.analytics?.impressions || 0;
        const impressions = post.analytics?.impressions || views;

        languageStats[lang].totalEngagement += engagement;
        languageStats[lang].totalViews += views;
        languageStats[lang].totalImpressions += impressions;

        languageStats[lang].posts.push({
          postId: post._id,
          platform: post.platform,
          engagement,
          views,
          impressions,
          engagementRate: impressions > 0 ? (engagement / impressions) * 100 : 0
        });
      });
    }

    // Calculate averages
    Object.keys(languageStats).forEach(lang => {
      const stats = languageStats[lang];
      if (stats.postCount > 0) {
        stats.averageEngagement = Math.round(stats.totalEngagement / stats.postCount);
        stats.averageEngagementRate = stats.totalImpressions > 0
          ? (stats.totalEngagement / stats.totalImpressions) * 100
          : 0;
      }
    });

    // Sort by average engagement
    const sorted = Object.values(languageStats).sort((a, b) => 
      b.averageEngagement - a.averageEngagement
    );

    return {
      period,
      totalLanguages: sorted.length,
      languages: sorted,
      topPerformer: sorted[0] || null,
      recommendations: generateLanguageRecommendations(sorted)
    };
  } catch (error) {
    logger.error('Error getting language performance', { error: error.message, userId });
    throw error;
  }
}

/**
 * Generate language recommendations
 */
function generateLanguageRecommendations(languageStats) {
  const recommendations = [];

  if (languageStats.length === 0) {
    recommendations.push('No language data available. Consider creating translations for your content.');
    return recommendations;
  }

  const topPerformer = languageStats[0];
  const bottomPerformer = languageStats[languageStats.length - 1];

  if (topPerformer.averageEngagement > bottomPerformer.averageEngagement * 1.5) {
    recommendations.push(`${topPerformer.language.toUpperCase()} content performs significantly better. Consider focusing on this language.`);
  }

  if (languageStats.length < 3) {
    recommendations.push('Consider expanding to more languages to reach a broader audience.');
  }

  const lowPerformers = languageStats.filter(s => s.averageEngagement < topPerformer.averageEngagement * 0.7);
  if (lowPerformers.length > 0) {
    recommendations.push(`Some languages (${lowPerformers.map(l => l.language.toUpperCase()).join(', ')}) are underperforming. Review translation quality or audience targeting.`);
  }

  return recommendations;
}

/**
 * Get language distribution
 */
async function getLanguageDistribution(userId) {
  try {
    const translations = await ContentTranslation.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 },
          avgQualityScore: { $avg: '$metadata.qualityScore' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const total = translations.reduce((sum, t) => sum + t.count, 0);

    return {
      total,
      languages: translations.map(t => ({
        language: t._id,
        count: t.count,
        percentage: total > 0 ? Math.round((t.count / total) * 100) : 0,
        avgQualityScore: Math.round(t.avgQualityScore || 0)
      }))
    };
  } catch (error) {
    logger.error('Error getting language distribution', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get platform-language performance
 */
async function getPlatformLanguagePerformance(userId, platform) {
  try {
    const translations = await ContentTranslation.find({ userId }).lean();
    const contentIds = [...new Set(translations.map(t => t.contentId.toString()))];

    const posts = await ScheduledPost.find({
      userId,
      platform,
      contentId: { $in: contentIds },
      status: 'posted'
    }).lean();

    const platformLanguageStats = {};

    for (const translation of translations) {
      const lang = translation.language.toLowerCase();
      const contentPosts = posts.filter(p => 
        p.contentId && p.contentId.toString() === translation.contentId.toString()
      );

      if (contentPosts.length === 0) continue;

      if (!platformLanguageStats[lang]) {
        platformLanguageStats[lang] = {
          language: lang,
          postCount: 0,
          totalEngagement: 0,
          totalImpressions: 0
        };
      }

      contentPosts.forEach(post => {
        platformLanguageStats[lang].postCount++;
        platformLanguageStats[lang].totalEngagement += post.analytics?.engagement || 0;
        platformLanguageStats[lang].totalImpressions += post.analytics?.impressions || 0;
      });
    }

    // Calculate averages
    Object.keys(platformLanguageStats).forEach(lang => {
      const stats = platformLanguageStats[lang];
      stats.averageEngagement = stats.postCount > 0
        ? Math.round(stats.totalEngagement / stats.postCount)
        : 0;
      stats.averageEngagementRate = stats.totalImpressions > 0
        ? (stats.totalEngagement / stats.totalImpressions) * 100
        : 0;
    });

    return Object.values(platformLanguageStats).sort((a, b) => 
      b.averageEngagement - a.averageEngagement
    );
  } catch (error) {
    logger.error('Error getting platform language performance', { error: error.message, userId, platform });
    throw error;
  }
}

module.exports = {
  getLanguagePerformance,
  getLanguageDistribution,
  getPlatformLanguagePerformance
};


