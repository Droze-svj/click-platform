// AI Content Adaptation Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { adaptContent, oneClickRepurpose, getSmartSuggestions } = require('../../services/contentAdaptationService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * POST /api/ai/adapt-content
 * Adapt content for multiple platforms
 */
router.post('/adapt-content', auth, asyncHandler(async (req, res) => {
  const { contentId, text, title, platforms } = req.body;

  if (!contentId || !text) {
    return sendError(res, 'Content ID and text are required', 400);
  }

  const targetPlatforms = platforms || ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'];
  
  const result = await adaptContent(
    req.user._id,
    contentId,
    text,
    title || 'Untitled',
    targetPlatforms
  );

  sendSuccess(res, 'Content adapted successfully', 200, result);
}));

/**
 * POST /api/ai/repurpose
 * One-click repurpose content
 */
router.post('/repurpose', auth, asyncHandler(async (req, res) => {
  const { contentId, platforms } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const targetPlatforms = platforms || ['twitter', 'linkedin', 'instagram', 'facebook', 'youtube', 'tiktok'];
  
  const result = await oneClickRepurpose(
    req.user._id,
    contentId,
    targetPlatforms
  );

  sendSuccess(res, 'Content repurposed successfully', 200, result);
}));

/**
 * GET /api/ai/smart-suggestions
 * Get smart content suggestions based on performance
 */
router.get('/smart-suggestions', auth, asyncHandler(async (req, res) => {
  const { limit = 5 } = req.query;
  
  const suggestions = await getSmartSuggestions(req.user._id, parseInt(limit));
  
  sendSuccess(res, 'Suggestions retrieved', 200, {
    suggestions
  });
}));

module.exports = router;


