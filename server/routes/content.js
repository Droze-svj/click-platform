const express = require('express');
const Content = require('../models/Content');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { validateContentGenerate } = require('../validators/contentValidator');
const { generateSocialContent, generateBlogSummary, generateViralIdeas } = require('../services/aiService');
const { emitToUser } = require('../services/socketService');
const logger = require('../utils/logger');
const { requireActiveSubscription } = require('../middleware/subscriptionAccess');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/content/generate:
 *   post:
 *     summary: Generate social media content from text
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 50
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [article, podcast, transcript]
 *               platforms:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [twitter, linkedin, instagram, facebook, tiktok]
 *     responses:
 *       200:
 *         description: Content generation started
 *       400:
 *         description: Validation error
 */
router.post('/generate', auth, requireActiveSubscription, validateContentGenerate, async (req, res) => {
  try {
    const { text, title, type, platforms } = req.body;

    const content = new Content({
      userId: req.user._id,
      type: type || 'article',
      title: title || 'Untitled',
      description: text.substring(0, 200),
      transcript: text,
      status: 'processing'
    });

    await content.save();

    // Generate content in background using job queue
    const { addContentGenerationJob, JOB_PRIORITY } = require('../queues');
    const job = await addContentGenerationJob({
      contentId: content._id.toString(),
      text,
      user: {
        _id: req.user._id.toString(),
        email: req.user.email,
        name: req.user.name,
      },
      platforms,
    }, {
      priority: JOB_PRIORITY.NORMAL,
      jobId: `content-${content._id}`,
    });

    logger.info('Content generation started', { 
      contentId: content._id, 
      userId: req.user._id,
      type: type || 'article'
    });

    // Track action for workflow learning
    await trackAction(req.user._id, 'generate_content', {
      entityType: 'content',
      entityId: content._id,
      type: type || 'article',
      platforms: platforms || []
    });

    // Update engagement
    const { updateStreak, checkAchievements, createActivity } = require('../services/engagementService');
    await updateStreak(req.user._id);
    const achievements = await checkAchievements(req.user._id, 'generate_content', {
      contentId: content._id,
      platforms: platforms || []
    });
    await createActivity(req.user._id, 'content_generated', {
      title: 'Content Generated! ✨',
      description: `You generated content for ${(platforms || []).length || 3} platforms`,
      entityType: 'content',
      entityId: content._id,
      metadata: { platforms: platforms || [] }
    });

    res.json({
      success: true,
      message: 'Content generation started',
      data: {
        contentId: content._id
      }
    });
  } catch (error) {
    logger.error('Content generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function generateContentFromText(contentId, text, user, platforms = ['twitter', 'linkedin', 'instagram']) {
  try {
    const content = await Content.findById(contentId);
    if (!content) return;

    // Generate social media posts
    const socialContent = await generateSocialContent(text, user.niche, platforms);
    const socialPosts = Object.values(socialContent).map(item => ({
      platform: item.platform,
      content: item.text,
      hashtags: item.hashtags
    }));

    // Generate blog summary
    const blogSummary = await generateBlogSummary(text, user.niche);

    // Generate viral ideas
    const viralIdeas = await generateViralIdeas(content.title || 'Content', user.niche, 5);

    content.generatedContent = {
      socialPosts,
      blogSummary,
      viralIdeas
    };
    content.status = 'completed';
    await content.save();

    // Update usage
    await User.findByIdAndUpdate(user._id, {
      $inc: { 'usage.contentGenerated': 1 }
    });

    // Emit real-time update
    try {
      emitToUser(user._id.toString(), 'content-generated', {
        contentId: content._id.toString(),
        status: 'completed'
      });
    } catch (error) {
      // Socket not critical
    }
  } catch (error) {
    logger.error('Content generation error:', error);
    const content = await Content.findById(contentId);
    if (content) {
      content.status = 'failed';
      await content.save();
    }
  }
}

// Get generated content
router.get('/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({ 
        success: false,
        error: 'Content not found' 
      });
    }

    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    logger.error('Get content error', { error: error.message, contentId: req.params.contentId });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get all user content
router.get('/', auth, async (req, res) => {
  try {
    const { type, status, limit = 50, page = 1 } = req.query;
    const query = { userId: req.user._id };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Optimize query
    const { optimizeQuery } = require('../utils/queryOptimizer');
    
    const [contents, total] = await Promise.all([
      optimizeQuery(Content.find(query), {
        select: 'title description type status createdAt',
        lean: true,
        sort: { createdAt: -1 },
        skip,
        limit: parseInt(limit)
      }),
      Content.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: contents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get content list error', { error: error.message, userId: req.user._id });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Delete content
router.delete('/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }

    await content.deleteOne();

    logger.info('Content deleted', { contentId: req.params.contentId, userId: req.user._id });

    res.json({
      success: true,
      message: 'Content deleted successfully'
    });
  } catch (error) {
    logger.error('Delete content error', { error: error.message, contentId: req.params.contentId });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/content/{contentId}/duplicate:
 *   post:
 *     summary: Duplicate content
 *     tags: [Content]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:contentId/duplicate', auth, asyncHandler(async (req, res) => {
  const content = await Content.findOne({
    _id: req.params.contentId,
    userId: req.user._id,
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  // Create duplicate
  const duplicate = new Content({
    userId: req.user._id,
    title: `${content.title} (Copy)`,
    description: content.description,
    type: content.type,
    text: content.text,
    status: 'draft',
    tags: content.tags,
    category: content.category,
    folder: content.folder,
    generatedContent: content.generatedContent,
    metadata: content.metadata,
  });

  await duplicate.save();
  logger.info('Content duplicated', { originalId: content._id, duplicateId: duplicate._id, userId: req.user._id });

  sendSuccess(res, 'Content duplicated', 201, duplicate);
}));

// Content adaptation routes
router.use('/:contentId', require('./content/adapt'));

module.exports = router;

