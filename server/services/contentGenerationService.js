// Content generation service.
// Handles generation from text (dashboard content) and long-form (cross-client, gap-filling).

const Content = require('../models/Content');
const User = require('../models/User');
const { generateSocialContent, generateBlogSummary, generateViralIdeas, generateContentIdea } = require('./aiService');
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

    // No platform produced a post (AI unavailable, over quota, or failing).
    // Record that honestly rather than saving an empty "completed" result and
    // counting it against the user's usage. Returned, not thrown: a throw makes
    // the queue retry, and retrying against an exhausted quota only burns more.
    if (socialPosts.length === 0) {
      const reason = 'AI content generation is unavailable right now, so no social posts were produced';
      logger.warn('Content generation produced no social posts', { contentId });
      content.status = 'failed';
      content.errorMessage = reason;
      await content.save();
      try {
        emitToUser(String(userId), 'content-generated', {
          contentId: content._id.toString(),
          status: 'failed',
          error: reason,
        });
      } catch (err) {
        logger.debug('Socket emit skipped', { contentId });
      }
      return { generated: false, reason };
    }

    report(50, 'Creating blog summary...');
    const blogSummary = await generateBlogSummary(text, niche);

    report(75, 'Generating viral ideas...');
    const viralIdeas = await generateViralIdeas(content.title || 'Content', niche, 5, { userId: content.userId });

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
    // A Content document keeps its text under content.text; `content.content` is
    // that sub-object, not a string. Reading it directly handed the model
    // "[object Object]" to adapt — for cross-client templates and gap filling alike.
    const text = String(
      (typeof content?.content === 'string' ? content.content : content?.content?.text)
      || content?.text || content?.transcript || ''
    ).trim();
    const title = content?.title || 'Original Video';
    const platform = options?.platform || 'twitter';
    const niche = content?.niche || 'general';

    if (!text) {
      return { success: false, message: 'Source content has no text to adapt' };
    }

    logger.info('Generating social content from long-form', {
      platform,
      contentId: content?._id || content?.id
    });

    // A "generated" post that is just the source text again is not a result.
    const isNewText = (candidate) => typeof candidate === 'string' && candidate.trim() && candidate.trim() !== text;

    // Call generateSocialContent from aiService
    const result = await generateSocialContent(text, niche, [platform]);
    const post = result?.[platform];
    if (post && isNewText(post.text)) {
      return {
        success: true,
        posts: [{
          platform: post.platform || platform,
          content: post.text.trim(),
          hashtags: post.hashtags || [],
        }]
      };
    }

    // Fallback: the honest adapter. aiService.generateContentAdaptation returns the
    // ORIGINAL text as its "adaptation" (with a made-up score) whenever the model
    // fails, which made a copy of the source look like a new post.
    // contentAdaptationService marks that case degraded instead.
    const { adaptForPlatform } = require('./contentAdaptationService');
    const adaptation = await adaptForPlatform(platform, text, title, options?.userId);
    if (adaptation && adaptation.optimized && !adaptation.degraded && isNewText(adaptation.content)) {
      return {
        success: true,
        posts: [{
          platform,
          content: adaptation.content.trim(),
          hashtags: adaptation.hashtags || [],
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
 * Generate a content idea (title + description) for a gap context.
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

    // generateContentIdea takes a platforms ARRAY. This passed (niche, category),
    // so it threw inside, came back as filler reported as success, and then read
    // hook/hashtags — fields that function has never returned.
    const ideaResult = await generateContentIdea([options?.platform || 'twitter']);

    if (ideaResult && !ideaResult.degraded && ideaResult.idea) {
      return {
        success: true,
        content: {
          title: ideaResult.title,
          description: ideaResult.idea,
          category,
          topic,
          suggestedPosts: []
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
