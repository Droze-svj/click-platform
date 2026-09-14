// AI Content Idea Generation Route

const express = require('express');
const auth = require('../../middleware/auth');
const { generateContentIdea } = require('../../services/aiService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * POST /api/ai/generate-idea
 * Generate AI content idea
 */
router.post('/generate-idea', auth, asyncHandler(async (req, res) => {
  const { platforms } = req.body;

  const targetPlatforms = platforms || ['twitter', 'linkedin', 'instagram'];
  
  const idea = await generateContentIdea(targetPlatforms);

  // Same honest-degraded shape as the other AI surfaces (see ai/recommendations):
  // a 200 whose data says plainly that no idea was produced, instead of a
  // placeholder the client would seed straight into content generation.
  sendSuccess(
    res,
    idea.degraded ? 'Content idea temporarily unavailable' : 'Content idea generated',
    200,
    idea
  );
}));

module.exports = router;


