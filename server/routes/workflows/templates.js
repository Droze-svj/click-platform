// Workflow Templates Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  getWorkflowTemplates,
  createFromTemplate,
  getTemplateCategories,
} = require('../../services/workflowTemplateService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/', auth, asyncHandler(async (req, res) => {
  try {
    const templates = getWorkflowTemplates();
    sendSuccess(res, 'Workflow templates fetched', 200, templates);
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
    const workflow = await createFromTemplate(req.user._id, templateId, customizations || {});
    sendSuccess(res, 'Workflow created from template', 200, workflow);
  } catch (error) {
    logger.error('Create from template error', { error: error.message, templateId });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






