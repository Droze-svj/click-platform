// Content generation service.
// Handles generation from text (dashboard content) and long-form (cross-client, gap-filling).

const Content = require('../models/Content');
const User = require('../models/User');
const { generateSocialContent, generateBlogSummary, generateViralIdeas, generateContentAdaptation, generateContentIdea } = require('./aiService');
const { emitToUser } = require('./socketService');
const logger = require('../utils/logger');

const DEFAULT_PLATFORMS = ['twitter', 'linkedin', 'instagram'];

/**
 * Generate content from text (article, transcript, etc.) for social platforms.
 * Used by the content generation worker.
 * @param {string} contentId - Content document ID
 * @param {string} text - Source text
 * @param {Object} user - User object (needs _id, optional niche)
 * @param {string[]} [platforms] - Target platforms
 * @param {Function} [onProgress] - Callback(percent, message) for progress updates
 * @returns {Promise<void>}
 */
async function generateContentFromText(contentId, text, user, platforms = DEFAULT_PLATFORMS, onProgress) {
  const report = (pct, msg) => {
    if (typeof onProgress === 'function') onProgress(pct, msg);
  };

  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  const niche = user?.niche || 'general';
  const userId = user?._id || user;

  try {
    report(15, 'Generating social media posts...');
    const socialContent = await generateSocialContent(text, niche, platforms);
    const socialPosts = Object.values(socialContent)
      .filter(Boolean)
      .map((item) => ({
        platform: item.platform,
        content: item.text,
        hashtags: item.hashtags || [],
      }));

    report(50, 'Creating blog summary...');
    const blogSummary = await generateBlogSummary(text, niche);

    report(75, 'Generating viral ideas...');
    const viralIdeas = await generateViralIdeas(content.title || 'Content', niche, 5);

    content.generatedContent = {
      socialPosts,
      blogSummary,
      viralIdeas: Array.isArray(viralIdeas) ? viralIdeas : [],
    };
    content.status = 'completed';
    await content.save();

    try {
      await User.findByIdAndUpdate(userId, { $inc: { 'usage.contentGenerated': 1 } });
    } catch (err) {
      logger.warn('Could not update usage', { userId, error: err.message });
    }

    try {
      emitToUser(String(userId), 'content-generated', {
        contentId: content._id.toString(),
        status: 'completed',
      });
    } catch (err) {
      logger.debug('Socket emit skipped', { contentId });
    }
  } catch (error) {
    logger.error('Content generation failed', { contentId, error: error.message });
    const doc = await Content.findById(contentId);
    if (doc) {
      doc.status = 'failed';
      doc.errorMessage = error.message;
      await doc.save();
    }
    throw error;
  }
}

/**
 * Generate social posts from long-form content.
 * @param {Object} content - Content document
 * @param {Object} options - { platform, format, ... }
 * @returns {Promise<Object>} { success, posts?, message? }
 */
async function generateContentFromLongForm(content, options = {}) {
  try {
    const text = content?.content || content?.text || '';
    const title = content?.title || 'Original Video';
    const platform = options?.platform || 'twitter';
    const niche = content?.niche || 'general';

    logger.info('Generating social content from long-form', {
      platform,
      contentId: content?._id || content?.id
    });

    // Call generateSocialContent from aiService
    const result = await generateSocialContent(text, niche, [platform]);
    const post = result[platform];
    if (post) {
      return {
        success: true,
        posts: [{
          platform: post.platform,
          content: post.text,
          hashtags: post.hashtags || [],
        }]
      };
    }
    
    // Fallback using generateContentAdaptation
    const adaptationResult = await generateContentAdaptation({
      text,
      title,
      platform,
      rules: {
        maxLength: platform === 'twitter' ? 280 : 1000,
        hashtags: 3,
        professional: true,
        visual: false,
        trending: true
      },
      examples: []
    });

    if (adaptationResult && adaptationResult.content) {
      return {
        success: true,
        posts: [{
          platform,
          content: adaptationResult.content,
          hashtags: adaptationResult.hashtags || [],
        }]
      };
    }

    return { success: false, message: 'Could not generate content from long-form' };
  } catch (err) {
    logger.warn('generateContentFromLongForm error', { error: err.message });
    return { success: false, message: err.message || 'Service not available' };
  }
}

/**
 * Generate content for gap-filling (e.g. platform, format, topic).
 * @param {Object} context - Gap context
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} { success, content?, message? }
 */
async function generateContent(context, options = {}) {
  try {
    const category = context?.category || 'general';
    const topic = context?.topic || 'viral trends';
    const niche = options?.niche || 'general';
    
    logger.info('Generating gap-filling content outline', {
      category,
      topic,
      niche
    });

    // Call generateContentIdea from aiService
    const ideaResult = await generateContentIdea(niche, category);
    
    if (ideaResult && ideaResult.title) {
      return {
        success: true,
        content: {
          title: ideaResult.title,
          description: ideaResult.hook || ideaResult.description || 'Generated content recommendation',
          category,
          topic,
          suggestedPosts: ideaResult.hashtags ? [{
            platform: options?.platform || 'twitter',
            text: `${ideaResult.title} - ${ideaResult.hook}`,
            hashtags: ideaResult.hashtags
          }] : []
        }
      };
    }
    return { success: false, message: 'Could not generate content idea' };
  } catch (err) {
    logger.warn('generateContent error', { error: err.message });
    return { success: false, message: err.message || 'Service not available' };
  }
}

module.exports = {
  generateContentFromText,
  generateContentFromLongForm,
  generateContent,
};
