// Asset Template Service
// Manages reusable asset templates

const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Create asset from template
 */
async function createAssetFromTemplate(userId, templateId, templateData = {}) {
  try {
    // Get template content
    const template = await Content.findOne({
      _id: templateId,
      userId,
      isTemplate: true
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Create new content from template
    const content = new Content({
      userId,
      title: templateData.title || template.title || 'Untitled',
      description: templateData.description || template.description || '',
      type: template.type,
      category: templateData.category || template.category || 'general',
      tags: templateData.tags || template.tags || [],
      body: templateData.body || template.body || '',
      transcript: templateData.transcript || template.transcript || '',
      isTemplate: false,
      status: 'completed'
    });

    await content.save();

    // Update template usage
    await Content.findByIdAndUpdate(templateId, {
      $inc: { 'analytics.usageCount': 1 }
    });

    logger.info('Asset created from template', { userId, templateId, contentId: content._id });
    return content;
  } catch (error) {
    logger.error('Error creating asset from template', { error: error.message, userId, templateId });
    throw error;
  }
}

/**
 * Mark content as template
 */
async function markAsTemplate(userId, contentId, isTemplate = true) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    });

    if (!content) {
      throw new Error('Content not found');
    }

    content.isTemplate = isTemplate;
    await content.save();

    logger.info('Content template status updated', { userId, contentId, isTemplate });
    return content;
  } catch (error) {
    logger.error('Error marking as template', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get user's templates
 */
async function getUserTemplates(userId, options = {}) {
  try {
    const { type = null, category = null } = options;

    const query = {
      userId,
      isTemplate: true
    };

    if (type) query.type = type;
    if (category) query.category = category;

    const templates = await Content.find(query)
      .sort({ 'analytics.usageCount': -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting user templates', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  createAssetFromTemplate,
  markAsTemplate,
  getUserTemplates
};


