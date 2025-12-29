// Language Optimization Service
// Optimizes content for platform-specific language requirements

const { translateContent } = require('./translationService');
const logger = require('../utils/logger');

// Platform-specific language requirements
const PLATFORM_LANGUAGE_REQUIREMENTS = {
  twitter: {
    maxLength: 280,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'ja', 'ko'],
    hashtagStyle: 'western',
    emojiSupport: true
  },
  linkedin: {
    maxLength: 3000,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it'],
    hashtagStyle: 'western',
    emojiSupport: false
  },
  facebook: {
    maxLength: 5000,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it', 'ar'],
    hashtagStyle: 'western',
    emojiSupport: true
  },
  instagram: {
    maxLength: 2200,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'ko'],
    hashtagStyle: 'western',
    emojiSupport: true
  },
  youtube: {
    maxLength: 5000,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'],
    hashtagStyle: 'western',
    emojiSupport: true
  },
  tiktok: {
    maxLength: 2200,
    preferredLanguages: ['en', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh'],
    hashtagStyle: 'western',
    emojiSupport: true
  }
};

/**
 * Optimize content for platform and language
 */
async function optimizeForPlatform(contentId, platform, targetLanguage, options = {}) {
  try {
    const {
      culturalAdaptation = true,
      hashtagOptimization = true,
      lengthOptimization = true
    } = options;

    // Get platform requirements
    const requirements = PLATFORM_LANGUAGE_REQUIREMENTS[platform.toLowerCase()] || PLATFORM_LANGUAGE_REQUIREMENTS.twitter;

    // Translate content
    const translation = await translateContent(contentId, targetLanguage, {
      culturalAdaptation,
      platformOptimization: platform,
      translationMethod: 'ai'
    });

    // Optimize hashtags for platform
    if (hashtagOptimization && translation.hashtags) {
      translation.hashtags = await optimizeHashtagsForPlatform(
        translation.hashtags,
        platform,
        targetLanguage
      );
    }

    // Optimize length if needed
    if (lengthOptimization && translation.body) {
      const currentLength = translation.body.length;
      if (currentLength > requirements.maxLength) {
        translation.body = translation.body.substring(0, requirements.maxLength - 3) + '...';
        logger.info('Content length optimized', { contentId, platform, originalLength: currentLength });
      }
    }

    // Update platform optimizations metadata
    if (!translation.metadata.platformOptimizations) {
      translation.metadata.platformOptimizations = new Map();
    }
    
    translation.metadata.platformOptimizations.set(platform, {
      optimized: true,
      optimizedAt: new Date(),
      lengthOptimized: lengthOptimization,
      hashtagOptimized: hashtagOptimization
    });

    await translation.save();

    return {
      translation,
      optimizations: {
        platform,
        language: targetLanguage,
        lengthOptimized: lengthOptimization && translation.body.length <= requirements.maxLength,
        hashtagOptimized: hashtagOptimization,
        culturalAdaptation
      }
    };
  } catch (error) {
    logger.error('Error optimizing for platform', { error: error.message, contentId, platform, targetLanguage });
    throw error;
  }
}

/**
 * Optimize hashtags for platform and language
 */
async function optimizeHashtagsForPlatform(hashtags, platform, language) {
  try {
    // Platform-specific hashtag rules
    const platformRules = PLATFORM_LANGUAGE_REQUIREMENTS[platform.toLowerCase()] || {};

    // Filter and optimize hashtags
    let optimized = hashtags.filter(h => h && h.trim().length > 0);

    // Remove duplicates
    optimized = [...new Set(optimized)];

    // Limit count based on platform
    const maxHashtags = {
      twitter: 2,
      linkedin: 5,
      facebook: 5,
      instagram: 30,
      youtube: 5,
      tiktok: 5
    };

    const max = maxHashtags[platform.toLowerCase()] || 5;
    optimized = optimized.slice(0, max);

    // Ensure hashtags are in correct format
    optimized = optimized.map(h => {
      h = h.trim();
      if (!h.startsWith('#')) {
        h = '#' + h;
      }
      // Remove special characters (keep only alphanumeric and underscore)
      h = h.replace(/[^#\w]/g, '');
      return h;
    }).filter(h => h.length > 1); // Filter out empty or single character

    return optimized;
  } catch (error) {
    logger.error('Error optimizing hashtags', { error: error.message, platform, language });
    return hashtags; // Return original on error
  }
}

/**
 * Get best language for platform based on audience
 */
async function getBestLanguageForPlatform(userId, platform, options = {}) {
  try {
    const { getAudienceInsights } = require('./advancedAudienceInsightsService');
    
    // Get audience insights
    const insights = await getAudienceInsights(userId, {
      period: 30,
      platform
    });

    // Extract language preferences from audience
    if (insights.hasData && insights.insights.demographics.languages) {
      const languages = insights.insights.demographics.languages;
      
      // Sort by percentage
      const sorted = languages.sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      
      if (sorted.length > 0) {
        return {
          recommendedLanguage: sorted[0].language || 'en',
          confidence: sorted[0].percentage || 0,
          alternatives: sorted.slice(1, 3).map(l => ({
            language: l.language,
            percentage: l.percentage
          }))
        };
      }
    }

    // Fallback to platform default
    const platformDefaults = {
      twitter: 'en',
      linkedin: 'en',
      facebook: 'en',
      instagram: 'en',
      youtube: 'en',
      tiktok: 'en'
    };

    return {
      recommendedLanguage: platformDefaults[platform.toLowerCase()] || 'en',
      confidence: 0.5,
      alternatives: []
    };
  } catch (error) {
    logger.error('Error getting best language for platform', { error: error.message, userId, platform });
    return {
      recommendedLanguage: 'en',
      confidence: 0.5,
      alternatives: []
    };
  }
}

/**
 * Batch optimize content for multiple platforms and languages
 */
async function batchOptimizeForPlatforms(contentId, platforms, languages, options = {}) {
  try {
    const results = {
      successful: [],
      failed: []
    };

    for (const platform of platforms) {
      for (const language of languages) {
        try {
          const optimization = await optimizeForPlatform(contentId, platform, language, options);
          results.successful.push({
            platform,
            language,
            translationId: optimization.translation._id
          });
        } catch (error) {
          logger.error('Error in batch optimization', { error: error.message, platform, language });
          results.failed.push({
            platform,
            language,
            error: error.message
          });
        }
      }
    }

    return results;
  } catch (error) {
    logger.error('Error in batch optimization', { error: error.message, contentId });
    throw error;
  }
}

module.exports = {
  optimizeForPlatform,
  optimizeHashtagsForPlatform,
  getBestLanguageForPlatform,
  batchOptimizeForPlatforms,
  PLATFORM_LANGUAGE_REQUIREMENTS
};


