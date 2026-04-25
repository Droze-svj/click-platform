// Advanced Content Generation Routes

const express = require('express');
const auth = require('../../middleware/auth');
const {
  generateAdvancedContent,
  generateContentVariations,
  generateFromAdvancedTemplate,
} = require('../../services/advancedContentGenerationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

router.post('/advanced', auth, asyncHandler(async (req, res) => {
  const { prompt, options } = req.body;
  if (!prompt) {
    return sendError(res, 'Prompt is required', 400);
  }
  try {
    const result = await generateAdvancedContent(prompt, options || {});
    sendSuccess(res, 'Advanced content generated', 200, result);
  } catch (error) {
    logger.error('Generate advanced content error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/variations', auth, asyncHandler(async (req, res) => {
  const { originalContent, count } = req.body;
  if (!originalContent) {
    return sendError(res, 'Original content is required', 400);
  }
  try {
    const variations = await generateContentVariations(originalContent, count || 3);
    sendSuccess(res, 'Content variations generated', 200, variations);
  } catch (error) {
    logger.error('Generate content variations error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

router.post('/template', auth, asyncHandler(async (req, res) => {
  const { templateType, variables, options } = req.body;
  if (!templateType || !variables) {
    return sendError(res, 'Template type and variables are required', 400);
  }
  try {
    const content = await generateFromAdvancedTemplate(templateType, variables, options || {});
    sendSuccess(res, 'Content generated from template', 200, content);
  } catch (error) {
    logger.error('Generate from advanced template error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






