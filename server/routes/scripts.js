// Script generation routes

const express = require('express');
const Script = require('../models/Script');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireActiveSubscription } = require('../middleware/subscriptionAccess');
const {
  generateYouTubeScript,
  generatePodcastScript,
  generateSocialMediaScript,
  generateBlogScript,
  generateEmailScript
} = require('../services/scriptService');
const { trackAction } = require('../services/workflowService');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/scripts/generate:
 *   post:
 *     summary: Generate a script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/generate', auth, requireActiveSubscription, async (req, res) => {
  try {
    const { topic, type, options = {} } = req.body;

    if (!topic || !type) {
      return res.status(400).json({
        success: false,
        error: 'Topic and type are required'
      });
    }

    const validTypes = ['youtube', 'podcast', 'video', 'presentation', 'blog', 'social-media', 'email', 'sales'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid script type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    let scriptData;

    // Generate script based on type
    switch (type) {
      case 'youtube':
      case 'video':
        scriptData = await generateYouTubeScript(topic, {
          ...options,
          targetAudience: options.targetAudience || req.user.niche || 'general audience'
        });
        break;
      case 'podcast':
        scriptData = await generatePodcastScript(topic, {
          ...options,
          targetAudience: options.targetAudience || req.user.niche || 'general audience'
        });
        break;
      case 'social-media':
        scriptData = await generateSocialMediaScript(topic, {
          ...options,
          platform: options.platform || 'instagram'
        });
        break;
      case 'blog':
        scriptData = await generateBlogScript(topic, {
          ...options,
          targetAudience: options.targetAudience || req.user.niche || 'general audience'
        });
        break;
      case 'email':
        scriptData = await generateEmailScript(topic, {
          ...options,
          type: options.emailType || 'marketing'
        });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported script type'
        });
    }

    // Save script to database
    const script = new Script({
      userId: req.user._id,
      title: scriptData.title || `${topic} - ${type} Script`,
      type,
      topic,
      targetAudience: options.targetAudience || req.user.niche || 'general audience',
      tone: options.tone || 'professional',
      duration: scriptData.duration,
      wordCount: scriptData.wordCount,
      script: scriptData.script,
      structure: {
        introduction: scriptData.introduction,
        mainPoints: scriptData.mainPoints || [],
        conclusion: scriptData.conclusion,
        callToAction: scriptData.callToAction
      },
      metadata: {
        keywords: scriptData.keywords || [],
        hashtags: scriptData.hashtags || [],
        timestamps: scriptData.timestamps || []
      },
      status: 'completed'
    });

    await script.save();

    // Update user usage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'usage.contentGenerated': 1 }
    });

    logger.info('Script generated', {
      scriptId: script._id,
      type,
      userId: req.user._id
    });

    // Track action for workflow learning
    await trackAction(req.user._id, 'generate_script', {
      entityType: 'script',
      entityId: script._id,
      scriptType: type,
      topic: topic
    });

    // Update engagement
    const { updateStreak, checkAchievements, createActivity } = require('../services/engagementService');
    await updateStreak(req.user._id);
    const achievements = await checkAchievements(req.user._id, 'generate_script', {
      scriptId: script._id,
      scriptType: type
    });
    await createActivity(req.user._id, 'script_created', {
      title: 'Script Created! 📝',
      description: `You created a ${type} script`,
      entityType: 'script',
      entityId: script._id,
      metadata: { scriptType: type }
    });

    res.json({
      success: true,
      message: 'Script generated successfully',
      data: script
    });
  } catch (error) {
    logger.error('Script generation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/scripts:
 *   get:
 *     summary: Get user's scripts
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, async (req, res) => {
  try {
    // Early check for dev users to avoid any database operations
    const userId = req.user?._id || req.user?.id;
    
    // In development mode OR when running on localhost, return empty array for dev users
    // This prevents MongoDB queries with invalid ObjectIds like 'dev-user-123'
    // Check both host header and x-forwarded-host (for proxy requests)
    const host = req.headers.host || req.headers['x-forwarded-host'] || '';
    const referer = req.headers.referer || req.headers.origin || '';
    const forwardedFor = req.headers['x-forwarded-for'] || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || 
                        referer.includes('localhost') || referer.includes('127.0.0.1') ||
                        (typeof forwardedFor === 'string' && (forwardedFor.includes('127.0.0.1') || forwardedFor.includes('localhost')));
    // Always allow dev mode when NODE_ENV is not production OR when on localhost
    // If NODE_ENV is undefined/null/empty, treat as dev mode
    const nodeEnv = process.env.NODE_ENV;
    const allowDevMode = !nodeEnv || nodeEnv !== 'production' || isLocalhost;
    
    // Enhanced logging for debugging (always log for localhost requests)
    if (isLocalhost || !nodeEnv || nodeEnv !== 'production') {
      console.log('🔧 [Scripts] GET request received', {
        userId,
        host,
        referer,
        isLocalhost,
        allowDevMode,
        nodeEnv: nodeEnv || 'undefined',
        hasUser: !!req.user,
        userKeys: req.user ? Object.keys(req.user) : [],
        userAgent: req.headers['user-agent']?.substring(0, 50),
        xForwardedHost: req.headers['x-forwarded-host'],
        xForwardedFor: forwardedFor
      });
      logger.info('Scripts GET request', {
        userId,
        host,
        referer,
        isLocalhost,
        allowDevMode,
        nodeEnv: nodeEnv || 'undefined',
        hasUser: !!req.user,
        userAgent: req.headers['user-agent']?.substring(0, 50),
        xForwardedHost: req.headers['x-forwarded-host'],
        xForwardedFor: forwardedFor
      });
    }
    
    // Check if MongoDB is connected first
    const mongoose = require('mongoose');
    const isMongoConnected = mongoose.connection.readyState === 1;
    
    // For dev mode OR when MongoDB isn't connected, return empty array immediately
    // This prevents any database operations that could fail
    if (allowDevMode || !isMongoConnected) {
      // Check for dev users FIRST, before any MongoDB operations
      if (userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123')) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(req.query.page || 1),
            limit: parseInt(req.query.limit || 50),
            total: 0,
            pages: 0
          }
        });
      }
      // If MongoDB not connected, return empty array for dev mode anyway
      if (!isMongoConnected && allowDevMode) {
        logger.warn('MongoDB not connected, returning empty array for dev mode');
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(req.query.page || 1),
            limit: parseInt(req.query.limit || 50),
            total: 0,
            pages: 0
          }
        });
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found'
      });
    }
    
    // Final safety check: if userId is a dev user ID, return empty array
    // This prevents CastError when Mongoose tries to cast 'dev-user-123' to ObjectId
    if (userId && (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123' || userId.toString().startsWith('test-'))) {
      console.log('🔧 [Scripts] Dev user detected, returning empty array', { userId, allowDevMode });
      logger.info('Dev user detected in scripts route, returning empty array', { userId, allowDevMode });
      return res.json({
        success: true,
        data: [],
        pagination: {
          page: parseInt(req.query.page || 1),
          limit: parseInt(req.query.limit || 50),
          total: 0,
          pages: 0
        }
      });
    }

    // At this point, we need MongoDB connected for production users
    if (!isMongoConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database connection unavailable'
      });
    }

    const { type, status, limit = 50, page = 1 } = req.query;

    // Try to execute queries, but handle all errors gracefully
    let scripts = [];
    let total = 0;
    
    try {
      // Validate userId is a valid ObjectId before creating query
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error(`Invalid userId format: ${userId}. Expected MongoDB ObjectId.`);
      }
      
      const query = { userId };
      if (type) query.type = type;
      if (status) query.status = status;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const { optimizeQuery } = require('../utils/queryOptimizer');

      const optimizedQuery = optimizeQuery(Script.find(query), {
        select: 'title type topic duration wordCount status createdAt',
        lean: true,
        sort: { createdAt: -1 },
        skip,
        limit: parseInt(limit)
      });

      // Execute queries - optimizeQuery already applied lean(), just need exec()
      [scripts, total] = await Promise.all([
        optimizedQuery.exec(),
        Script.countDocuments(query).exec()
      ]);
    } catch (dbError) {
      // If it's a CastError (invalid ObjectId) or connection error, return empty array for dev mode
      if (allowDevMode && (dbError.name === 'CastError' || dbError.message?.includes('buffering') || dbError.message?.includes('connection'))) {
        logger.warn('Database error in scripts query, returning empty array for dev mode', { 
          error: dbError.message,
          errorName: dbError.name,
          userId 
        });
        scripts = [];
        total = 0;
      } else {
        // Re-throw if not a dev mode error
        throw dbError;
      }
    }

    res.json({
      success: true,
      data: scripts || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    // Enhanced error logging
    console.error('❌ [Scripts] Error in GET /api/scripts', {
      error: error.message,
      errorName: error.name,
      errorCode: error.code,
      stack: error.stack?.substring(0, 500),
      userId: req.user?._id || req.user?.id,
      hasUser: !!req.user,
      nodeEnv: process.env.NODE_ENV || 'undefined'
    });
    
    logger.error('Get scripts error', { 
      error: error.message, 
      stack: error.stack, 
      userId: req.user?._id || req.user?.id,
      errorName: error.name,
      errorCode: error.code,
      hasUser: !!req.user
    });
    
    // Return error response - ensure we haven't already sent a response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Failed to load scripts' : error.message,
        ...(process.env.NODE_ENV !== 'production' && { 
          details: error.name,
          stack: error.stack?.substring(0, 200)
        })
      });
    } else {
      console.error('⚠️ [Scripts] Response already sent, cannot send error response');
    }
  }
});

/**
 * @swagger
 * /api/scripts/{scriptId}:
 *   get:
 *     summary: Get specific script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:scriptId', auth, async (req, res) => {
  try {
    const script = await Script.findOne({
      _id: req.params.scriptId,
      userId: req.user._id
    });

    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    logger.error('Get script error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/scripts/{scriptId}:
 *   put:
 *     summary: Update script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:scriptId', auth, async (req, res) => {
  try {
    const script = await Script.findOne({
      _id: req.params.scriptId,
      userId: req.user._id
    });

    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['title', 'script', 'status', 'structure', 'metadata'];
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        script[field] = req.body[field];
      }
    });

    // Recalculate word count if script changed
    if (req.body.script) {
      script.wordCount = req.body.script.split(/\s+/).length;
    }

    await script.save();

    res.json({
      success: true,
      message: 'Script updated successfully',
      data: script
    });
  } catch (error) {
    logger.error('Update script error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/scripts/{scriptId}:
 *   delete:
 *     summary: Delete script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:scriptId', auth, async (req, res) => {
  try {
    const script = await Script.findOne({
      _id: req.params.scriptId,
      userId: req.user._id
    });

    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    await script.deleteOne();

    logger.info('Script deleted', { scriptId: req.params.scriptId });

    res.json({
      success: true,
      message: 'Script deleted successfully'
    });
  } catch (error) {
    logger.error('Delete script error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/scripts/{scriptId}/duplicate:
 *   post:
 *     summary: Duplicate a script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:scriptId/duplicate', auth, async (req, res) => {
  try {
    const script = await Script.findOne({
      _id: req.params.scriptId,
      userId: req.user._id
    });

    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    const copy = new Script({
      userId: req.user._id,
      title: (script.title || 'Untitled').replace(/\s*\(Copy(?:\s*\d*)?\)\s*$/, '') + ' (Copy)',
      type: script.type,
      topic: script.topic,
      targetAudience: script.targetAudience,
      tone: script.tone,
      duration: script.duration,
      wordCount: script.wordCount,
      script: script.script,
      structure: script.structure ? { ...script.structure } : undefined,
      metadata: script.metadata ? { ...script.metadata } : undefined,
      status: 'draft'
    });
    await copy.save();

    res.status(201).json({
      success: true,
      message: 'Script duplicated',
      data: copy
    });
  } catch (error) {
    logger.error('Duplicate script error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/scripts/{scriptId}/export:
 *   get:
 *     summary: Export script
 *     tags: [Scripts]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:scriptId/export', auth, async (req, res) => {
  try {
    const { format = 'txt' } = req.query;
    const script = await Script.findOne({
      _id: req.params.scriptId,
      userId: req.user._id
    });

    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    let content = '';
    let contentType = 'text/plain';
    let filename = `${script.title.replace(/\s+/g, '-')}.txt`;

    if (format === 'txt') {
      content = `Title: ${script.title}\n`;
      content += `Type: ${script.type}\n`;
      content += `Topic: ${script.topic}\n`;
      content += `Word Count: ${script.wordCount}\n`;
      if (script.duration) {
        content += `Duration: ${script.duration} minutes\n`;
      }
      content += `\n${'='.repeat(50)}\n\n`;
      content += script.script;
      
      if (script.metadata.timestamps && script.metadata.timestamps.length > 0) {
        content += `\n\n${'='.repeat(50)}\nTimestamps:\n`;
        script.metadata.timestamps.forEach(ts => {
          content += `${ts.time} - ${ts.section}\n`;
        });
      }
    } else if (format === 'json') {
      contentType = 'application/json';
      filename = filename.replace('.txt', '.json');
      content = JSON.stringify(script, null, 2);
    } else if (format === 'docx') {
      // For DOCX, we'd need a library like docx
      // For now, return as text
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = filename.replace('.txt', '.docx');
      content = script.script;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    logger.error('Export script error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

