// Curation Template Service
// Manages curation templates

const CurationTemplate = require('../models/CurationTemplate');
const { autoCurateContent } = require('./contentCurationService');
const logger = require('../utils/logger');

/**
 * Create curation template
 */
async function createCurationTemplate(userId, templateData) {
  try {
    const template = new CurationTemplate({
      userId,
      name: templateData.name,
      description: templateData.description || '',
      isPublic: templateData.isPublic || false,
      criteria: templateData.criteria || {},
      actions: templateData.actions || {}
    });

    await template.save();
    logger.info('Curation template created', { templateId: template._id, userId });
    return template;
  } catch (error) {
    logger.error('Error creating curation template', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user's templates
 */
async function getUserTemplates(userId, includePublic = false) {
  try {
    const query = includePublic
      ? { $or: [{ userId }, { isPublic: true }] }
      : { userId };

    const templates = await CurationTemplate.find(query)
      .sort({ useCount: -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting user templates', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get public templates
 */
async function getPublicTemplates(limit = 20) {
  try {
    const templates = await CurationTemplate.find({
      isPublic: true
    })
      .sort({ useCount: -1 })
      .limit(limit)
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting public templates', { error: error.message });
    throw error;
  }
}

/**
 * Use template for curation
 */
async function useTemplateForCuration(templateId, userId) {
  try {
    const template = await CurationTemplate.findOne({
      _id: templateId,
      $or: [
        { userId },
        { isPublic: true }
      ]
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Execute curation with template settings
    const result = await autoCurateContent(userId, {
      minScore: template.criteria.minScore || 70,
      maxItems: template.actions.maxItems || 10,
      platforms: template.criteria.platforms || null,
      contentTypes: template.criteria.contentTypes || null,
      scheduleAutomatically: template.actions.autoSchedule || false,
      scheduleDate: template.actions.scheduleDate || null
    });

    // Update template stats
    template.useCount += 1;
    template.lastUsed = new Date();
    await template.save();

    return {
      templateId: template._id,
      templateName: template.name,
      ...result
    };
  } catch (error) {
    logger.error('Error using template for curation', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Update template
 */
async function updateCurationTemplate(templateId, userId, updates) {
  try {
    const template = await CurationTemplate.findOne({
      _id: templateId,
      userId
    });

    if (!template) {
      throw new Error('Template not found');
    }

    Object.assign(template, updates);
    await template.save();

    return template;
  } catch (error) {
    logger.error('Error updating template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Delete template
 */
async function deleteCurationTemplate(templateId, userId) {
  try {
    const template = await CurationTemplate.findOneAndDelete({
      _id: templateId,
      userId
    });

    if (!template) {
      throw new Error('Template not found');
    }

    return template;
  } catch (error) {
    logger.error('Error deleting template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Duplicate template
 */
async function duplicateTemplate(templateId, userId, newName) {
  try {
    const template = await CurationTemplate.findOne({
      _id: templateId,
      $or: [
        { userId },
        { isPublic: true }
      ]
    }).lean();

    if (!template) {
      throw new Error('Template not found');
    }

    const newTemplate = new CurationTemplate({
      userId,
      name: newName || `${template.name} (Copy)`,
      description: template.description,
      isPublic: false,
      criteria: template.criteria,
      actions: template.actions
    });

    await newTemplate.save();
    return newTemplate;
  } catch (error) {
    logger.error('Error duplicating template', { error: error.message, templateId });
    throw error;
  }
}

module.exports = {
  createCurationTemplate,
  getUserTemplates,
  getPublicTemplates,
  useTemplateForCuration,
  updateCurationTemplate,
  deleteCurationTemplate,
  duplicateTemplate
};


