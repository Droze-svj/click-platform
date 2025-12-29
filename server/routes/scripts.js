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
    const { type, status, limit = 50, page = 1 } = req.query;
    const query = { userId: req.user._id };

    if (type) query.type = type;
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const { optimizeQuery } = require('../utils/queryOptimizer');

    const [scripts, total] = await Promise.all([
      optimizeQuery(Script.find(query), {
        select: 'title type topic duration wordCount status createdAt',
        lean: true,
        sort: { createdAt: -1 },
        skip,
        limit: parseInt(limit)
      }),
      Script.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: scripts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get scripts error', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
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

