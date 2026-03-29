// Workflow Templates Routes

const express = require('express');
const auth = require('../../middleware/auth');
const UserSettings = require('../../models/UserSettings');
const {
  getWorkflowTemplates,
  createFromTemplate,
  getTemplateCategories,
  getSuggestedTemplateIds,
} = require('../../services/workflowTemplatesCatalogService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

function getUserId(req) {
  return req.user?.id || req.user?._id?.toString?.() || req.user?._id;
}

router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const templates = getWorkflowTemplates();
    const suggested = req.query.suggested === 'true' || req.query.suggested === '1';
    const payload = { templates };
    if (suggested) {
      const userId = req.user?._id || req.user?.id;
      try {
        payload.suggestedIds = await getSuggestedTemplateIds(userId);
      } catch (e) {
        payload.suggestedIds = ['content-to-posts', 'video-to-clips', 'script-to-quote'];
      }
    }
    sendSuccess(res, 'Workflow templates fetched', 200, payload);
  } catch (error) {
    logger.error('Get workflow templates error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.get('/categories', auth, asyncHandler(async (req, res) => {
  try {
    const categories = getTemplateCategories();
    sendSuccess(res, 'Template categories fetched', 200, categories);
  } catch (error) {
    logger.error('Get template categories error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/create', auth, asyncHandler(async (req, res) => {
  const { templateId, customizations } = req.body;
  if (!templateId) {
    return sendError(res, 'Template ID is required', 400);
  }
  try {
    const userId = getUserId(req);
    const workflow = await createFromTemplate(userId, templateId, customizations || {});
    try {
      await UserSettings.findOneAndUpdate(
        { userId: String(userId) },
        { $set: { 'preferences.lastUsedWorkflowTemplateId': templateId, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (e) {
      logger.warn('Could not save last-used template', { userId, templateId });
    }
    sendSuccess(res, 'Workflow created from template', 200, workflow);
  } catch (error) {
    logger.error('Create from template error', { error: error.message, templateId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






