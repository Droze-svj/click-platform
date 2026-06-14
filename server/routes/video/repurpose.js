/**
 * POST /api/video/repurpose — Multi-Format Repurpose Studio.
 *
 * One source video → N platform-native variants (smart-reframed to each aspect,
 * with per-platform AI copy). Returns immediately with a jobId per variant; the
 * renders run in the background and write to the SAME location the normal render
 * pipeline uses, so the existing endpoints poll/download them unchanged:
 *   GET /api/video/render/:jobId/status
 *   GET /api/video/render/:jobId/download
 *
 * Tiering: clampVariants caps how many variants a tier may request; the render
 * pipeline applies the resolution clamp + Free watermark + C2PA per variant.
 *
 * Body: { tree | videoUrl, targets?, transcript? }
 *   tree     — the editor RenderTree (videoUrl, duration, filters, overlays…)
 *   targets  — array of ratio strings ('9:16') and/or { ratio, platform } objects.
 *              Omit to get every supported aspect (clamped to the tier).
 */

const express = require('express');

const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { renderLimiter } = require('../../middleware/enhancedRateLimiter');
const { requireFeature, checkExportQuota } = require('../../middleware/tierGate');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const entitlements = require('../../config/entitlements');
const enforcement = require('../../services/entitlementEnforcement');
const usageService = require('../../services/usageService');
const repurposeService = require('../../services/repurposeService');

const router = express.Router();

const MAX_DURATION_SEC = 60 * 30; // mirror render.js per-render cap

router.post(
  '/repurpose',
  auth,
  renderLimiter,
  requireFeature('multi_format_repurpose'),
  checkExportQuota,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const tree = body.tree && typeof body.tree === 'object' ? body.tree : body;
    const targets = Array.isArray(body.targets) ? body.targets : undefined;

    // ── Validate ──
    if (!tree.videoUrl || typeof tree.videoUrl !== 'string') {
      return sendError(res, 'A source videoUrl (or tree.videoUrl) is required', 400);
    }
    if (tree.duration != null && (typeof tree.duration !== 'number' || tree.duration <= 0)) {
      return sendError(res, 'tree.duration must be a positive number', 400);
    }
    if (typeof tree.duration === 'number' && tree.duration > MAX_DURATION_SEC) {
      return sendError(res, 'tree.duration cannot exceed 30 minutes per render', 400);
    }
    if (targets && targets.length > 12) {
      return sendError(res, 'Too many targets (max 12)', 400);
    }

    const userId = req.user?.id || req.user?._id?.toString();
    const tier = entitlements.resolveTier(req.user || {});
    // Niche grounds the per-platform copy in the marketing playbook. Prefer an
    // explicit body override, else the creator's saved niche; getKnowledgeSlice
    // defaults to 'other' if unknown.
    const niche = (typeof body.niche === 'string' && body.niche.trim())
      || req.user?.niche || req.user?.social_links?.niche || undefined;

    // ── Resolve + guard the source up front (SSRF guard for remote URLs, exists
    //    check for local). A bad source fails the request synchronously. ──
    let sourcePath;
    try {
      sourcePath = await repurposeService.resolveSource(tree.videoUrl);
    } catch (e) {
      return sendError(res, e.message || 'Invalid source video', e.statusCode || 400);
    }

    // ── Plan variants (clamp count to tier, mint jobIds, generate copy) ──
    let plan;
    try {
      plan = await repurposeService.planRepurpose({
        baseTree: tree,
        targets,
        tier,
        niche,
        transcript: typeof body.transcript === 'string' ? body.transcript : undefined,
      });
    } catch (e) {
      logger.error('[repurpose] planning failed', { error: e.message });
      return sendError(res, 'Could not plan repurpose job', 500);
    }

    if (!plan.variants.length) {
      return sendError(res, 'No valid target aspect ratios. Allowed: ' + repurposeService.SUPPORTED_RATIOS.join(', '), 400);
    }

    // Count the whole repurpose as ONE metered export (best-effort).
    usageService.incrementUsage(userId, 'exports').catch((e) => {
      logger.warn('[repurpose] export usage increment failed', { userId, error: e.message });
    });

    // ── Fire the renders in the background; respond immediately. ──
    repurposeService
      .runVariants({ sourcePath, baseTree: tree, variants: plan.variants, tier, userId })
      .catch((e) => logger.error('[repurpose] runVariants crashed', { error: e.message }));

    const variants = plan.variants.map((v) => ({
      jobId: v.jobId,
      ratio: v.ratio,
      platform: v.platform,
      platformLabel: v.platformLabel,
      status: 'queued',
      hook: v.hook,
      title: v.title,
      description: v.description,
      hashtags: v.hashtags,
      statusUrl: `/api/video/render/${v.jobId}/status`,
      downloadUrl: `/api/video/render/${v.jobId}/download`,
    }));

    return sendSuccess(res, {
      status: 'queued',
      tier,
      watermarked: enforcement.mustWatermark(tier),
      variantsRequested: plan.clampedFrom,        // present only when clamped
      variants,
    });
  })
);

module.exports = router;
