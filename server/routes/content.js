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
    }).maxTimeMS(8000);

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
    const userId = req.user._id || req.user.id;
    
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                        (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
    
    // In development mode OR when running on localhost, return empty array for dev users
    // This prevents MongoDB queries with invalid ObjectIds like 'dev-user-123'
    if (allowDevMode && userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 50,
          total: 0,
          pages: 0
        }
      });
    }
    
    // Check if MongoDB is connected before attempting queries
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      if (allowDevMode) {
        logger.warn('MongoDB not connected, returning empty array for dev mode');
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            total: 0,
            pages: 0
          }
        });
      }
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable'
      });
    }
    
    const { type, status, limit = 50, page = 1 } = req.query;
    const query = { userId };
    
    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Try to execute queries, but handle all errors gracefully
    let contents = [];
    let total = 0;
    
    try {
      // Optimize query
      const { optimizeQuery } = require('../utils/queryOptimizer');
      
      const [contentsResult, totalResult] = await Promise.all([
        optimizeQuery(Content.find(query), {
          select: 'title description type status createdAt',
          lean: true,
          sort: { createdAt: -1 },
          skip,
          limit: parseInt(limit)
        }).maxTimeMS(8000).exec(),
        Content.countDocuments(query).maxTimeMS(8000).exec()
      ]);
      
      contents = contentsResult || [];
      total = totalResult || 0;
    } catch (dbError) {
      // If it's a CastError (invalid ObjectId) or connection error, return empty array for dev mode
      if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('buffering') || dbError.message?.includes('connection'))) {
        logger.warn('Database error in content query, returning empty array for dev mode', { 
          error: dbError.message,
          errorName: dbError.name,
          userId 
        });
        contents = [];
        total = 0;
      } else {
        // Re-throw if not a dev mode error
        throw dbError;
      }
    }

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
    const userId = req.user?._id || req.user?.id;
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                        (typeof req.headers['x-forwarded-for'] === 'string' && req.headers['x-forwarded-for'].includes('127.0.0.1'));
    const allowDevMode = process.env.NODE_ENV !== 'production' || isLocalhost;
    
    logger.error('Get content list error', { 
      error: error.message, 
      stack: error.stack,
      userId,
      errorName: error.name,
      errorCode: error.code
    });
    
    // For dev mode CastErrors or connection errors, return empty array instead of 500
    if (allowDevMode && (error.name === 'CastError' || error.message?.includes('buffering') || error.message?.includes('connection'))) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page) || 1,
          limit: parseInt(req.query.limit) || 50,
          total: 0,
          pages: 0
        }
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Failed to load content' : error.message,
      ...(process.env.NODE_ENV !== 'production' && { details: error.name })
    });
  }
});

// Delete content
router.delete('/:contentId', auth, async (req, res) => {
  try {
    const content = await Content.findOne({
      _id: req.params.contentId,
      userId: req.user._id
    }).maxTimeMS(8000);

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

