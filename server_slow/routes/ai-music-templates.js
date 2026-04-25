// AI Music Generation Templates Routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const MusicGenerationTemplate = require('../models/MusicGenerationTemplate');
const { generateMusicTrack } = require('../services/aiMusicGenerationService');
const router = express.Router();

/**
 * @route POST /api/ai-music/templates
 * @desc Create generation template
 * @access Private
 */
router.post('/templates', auth, asyncHandler(async (req, res) => {
  const {
    name,
    description,
    provider,
    params,
    useCases,
    tags,
    isPublic
  } = req.body;

  if (!name || !provider || !params) {
    return sendError(res, 'Name, provider, and params are required', 400);
  }

  try {
    const template = new MusicGenerationTemplate({
      userId: req.user._id,
      name,
      description,
      provider,
      params,
      useCases: useCases || [],
      tags: tags || [],
      isPublic: isPublic || false
    });

    await template.save();

    sendSuccess(res, 'Template created', 200, { template });
  } catch (error) {
    logger.error('Error creating template', { error: error.message, userId: req.user._id });
    sendError(res, error.message || 'Failed to create template', 500);
  }
}));

/**
 * @route GET /api/ai-music/templates
 * @desc Get templates (user's and public)
 * @access Private
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const { provider, useCase, search } = req.query;

  try {
    const query = {
      $or: [
        { userId: req.user._id },
        { isPublic: true }
      ]
    };

    if (provider) query.provider = provider;
    if (useCase) query.useCases = useCase;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const templates = await MusicGenerationTemplate.find(query)
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    sendSuccess(res, 'Templates retrieved', 200, { templates });
  } catch (error) {
    logger.error('Error getting templates', { error: error.message });
    sendError(res, error.message || 'Failed to get templates', 500);
  }
}));

/**
 * @route POST /api/ai-music/templates/:templateId/generate
 * @desc Generate music using template
 * @access Private
 */
router.post('/templates/:templateId/generate', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { duration, bpm } = req.body; // Override params if needed

  try {
    const template = await MusicGenerationTemplate.findById(templateId);

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    // Check access
    if (!template.isPublic && template.userId.toString() !== req.user._id.toString()) {
      return sendError(res, 'Unauthorized', 403);
    }

    // Merge template params with overrides
    const params = {
      ...template.params,
      ...(duration && { duration }),
      ...(bpm && { bpm })
    };

    // Generate music
    const generation = await generateMusicTrack(
      template.provider,
      params,
      req.user._id
    );

    // Update template usage
    template.usageCount++;
    await template.save();

    sendSuccess(res, 'Music generation started with template', 200, generation);
  } catch (error) {
    logger.error('Error generating with template', {
      error: error.message,
      templateId,
      userId: req.user._id
    });
    sendError(res, error.message || 'Failed to generate music', 500);
  }
}));

/**
 * @route DELETE /api/ai-music/templates/:templateId
 * @desc Delete template
 * @access Private
 */
router.delete('/templates/:templateId', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  try {
    const template = await MusicGenerationTemplate.findOne({
      _id: templateId,
      userId: req.user._id
    });

    if (!template) {
      return sendError(res, 'Template not found', 404);
    }

    await template.deleteOne();

    sendSuccess(res, 'Template deleted', 200);
  } catch (error) {
    logger.error('Error deleting template', { error: error.message, templateId });
    sendError(res, error.message || 'Failed to delete template', 500);
  }
}));

module.exports = router;







