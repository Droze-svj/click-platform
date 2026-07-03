// Smart Repurpose Studio routes
// POST /api/repurpose/studio         → preview N platform-native variants
// POST /api/repurpose/studio/schedule → schedule the reviewed variants

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { costGuard } = require('../middleware/costGuard');
const { guardOwnership } = require('../utils/ownership');
const { adaptForPlatform } = require('../services/contentAdaptationService');
const {
  buildVariantPreviews,
  scheduleVariants,
  normalizePlatforms,
} = require('../services/repurposeStudioService');

/**
 * POST /api/repurpose/studio
 * Body: { contentId?, text?, title?, platforms? }
 * Generate platform-native variant PREVIEWS (nothing is persisted). Provide
 * either a `contentId` (must be owned) or raw `text` (+ optional `title`).
 */
router.post('/studio', auth, aiLimiter, costGuard(), asyncHandler(async (req, res) => {
  const body = req.body || {};
  let text = body.text ? String(body.text) : '';
  let title = body.title ? String(body.title) : 'Untitled';

  if (body.contentId) {
    // Ownership-gated: guardOwnership sends the 404/403 and returns false on miss.
    const content = await guardOwnership(req, res, body.contentId);
    if (!content) return undefined;
    text = (content.content && content.content.text) || content.description || text;
    title = content.title || title;
  }

  if (!text || !text.trim()) {
    return sendError(res, 'Provide contentId or non-empty text to repurpose', 400);
  }

  const platforms = normalizePlatforms(body.platforms);
  const prompt = `Repurpose for ${platforms.length} platforms: ${text.slice(0, 400)}`;
  try {
    // One adaptation call per platform — bound the fan-out via a single budget
    // assertion sized to the batch.
    await req.assertBudget({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      prompt,
      expectedOutputTokens: 400 * platforms.length,
    });
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 402);
  }

  const variants = await buildVariantPreviews({ text, title, userId: req.user._id, platforms }, adaptForPlatform);

  await req.recordAiUsage({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    inputTokens: Math.ceil(prompt.length / 4),
    outputTokens: 400 * platforms.length,
    taskType: 'repurpose-studio',
  });

  return sendSuccess(res, 'Variants generated', 200, { variants, count: variants.length });
}));

/**
 * POST /api/repurpose/studio/schedule
 * Body: { variants: [{ platform, content, hashtags }], startAt?, cadenceHours?, status?, dryRun? }
 * Turn the reviewed variants into ScheduledPosts (pending_approval by default,
 * or 'scheduled' to go straight to the publish queue).
 */
router.post('/studio/schedule', auth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.variants) || body.variants.length === 0) {
    return sendError(res, 'variants array is required', 400);
  }
  if (body.variants.length > 50) {
    return sendError(res, 'Too many variants (max 50 per schedule)', 400);
  }

  const startMs = body.startAt ? new Date(body.startAt).getTime() : NaN;
  const result = await scheduleVariants(req.user._id, body.variants, {
    startAt: Number.isFinite(startMs) ? startMs : undefined,
    cadenceHours: body.cadenceHours,
    status: body.status,
    dryRun: !!body.dryRun,
  });
  return sendSuccess(res, 'Variants scheduled', 201, result);
}));

module.exports = router;
