/**
 * Repurpose Recipes — shareable, remixable repurpose "formulas".
 * Mounted at /api/video/repurpose/recipes.
 *
 *   POST   /            save the current repurpose config as a recipe
 *   GET    /            list recipes (?scope=mine|public|all)
 *   GET    /:id         fetch one recipe (own or public) incl. full config
 *   POST   /:id/apply   REMIX: apply a recipe to a new source video → variants
 *
 * Publishing a recipe PUBLIC needs the `template_publish` entitlement (Pro+);
 * lacking it, the recipe is saved private (graceful, never loses the user's
 * work). Applying a recipe runs through the SAME repurpose orchestrator as
 * POST /api/video/repurpose, so SSRF guard + tier clamp + watermark + C2PA all
 * apply, and the existing render status/download endpoints serve the variants.
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
const repurposeService = require('../../services/repurposeService');
const recipeService = require('../../services/repurposeRecipeService');

const router = express.Router();

const MAX_DURATION_SEC = 60 * 30;

function creatorName(user) {
  return user?.name || user?.fullName || user?.displayName || user?.username || user?.email || 'Creator';
}

// ── POST / — save a recipe ───────────────────────────────────────────────────
router.post(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Prefer the real ObjectId (_id) so Mongo casts cleanly — the dev user's
    // `id` is a non-hex string ('dev-user-123') that would fail ObjectId cast.
    const userId = req.user?._id || req.user?.id;
    const tier = entitlements.resolveTier(req.user || {});

    // Public publishing is a Pro+ feature. Without it we DON'T error — we save
    // the recipe privately so the user keeps their work, and tell them why.
    let isPublic = body.isPublic === true;
    let publicGated = false;
    if (isPublic && !entitlements.hasFeature(tier, 'template_publish')) {
      isPublic = false;
      publicGated = true;
    }

    let doc;
    try {
      doc = await recipeService.createRecipe({
        userId,
        userName: creatorName(req.user),
        name: body.name,
        description: body.description,
        isPublic,
        recipe: body.recipe || body,
      });
    } catch (e) {
      return sendError(res, e.message || 'Could not save recipe', e.statusCode || 500);
    }

    return sendSuccess(res, {
      recipe: recipeService.summarizeRecipe(doc, userId),
      publicGated,
      requiredTier: publicGated ? (entitlements.effectiveMinTier('template_publish') || 'pro') : undefined,
    });
  })
);

// ── GET / — list recipes ─────────────────────────────────────────────────────
router.get(
  '/',
  auth,
  asyncHandler(async (req, res) => {
    // Prefer the real ObjectId (_id) so Mongo casts cleanly — the dev user's
    // `id` is a non-hex string ('dev-user-123') that would fail ObjectId cast.
    const userId = req.user?._id || req.user?.id;
    const scope = ['mine', 'public', 'all'].includes(req.query.scope) ? req.query.scope : 'all';
    const recipes = await recipeService.listRecipes({ userId, scope, limit: req.query.limit });
    return sendSuccess(res, { scope, recipes });
  })
);

// ── GET /:id — fetch one (own or public) ─────────────────────────────────────
router.get(
  '/:id',
  auth,
  asyncHandler(async (req, res) => {
    // Prefer the real ObjectId (_id) so Mongo casts cleanly — the dev user's
    // `id` is a non-hex string ('dev-user-123') that would fail ObjectId cast.
    const userId = req.user?._id || req.user?.id;
    const doc = await recipeService.getRecipe(req.params.id, userId);
    if (!doc) return sendError(res, 'Recipe not found', 404);
    return sendSuccess(res, {
      recipe: { ...recipeService.summarizeRecipe(doc, userId), config: doc.recipe },
    });
  })
);

// ── POST /:id/apply — REMIX a recipe onto a new video ────────────────────────
router.post(
  '/:id/apply',
  auth,
  renderLimiter,
  requireFeature('multi_format_repurpose'),
  checkExportQuota,
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    // Prefer the real ObjectId (_id) so Mongo casts cleanly — the dev user's
    // `id` is a non-hex string ('dev-user-123') that would fail ObjectId cast.
    const userId = req.user?._id || req.user?.id;
    const tier = entitlements.resolveTier(req.user || {});

    if (!body.videoUrl || typeof body.videoUrl !== 'string') {
      return sendError(res, 'A source videoUrl is required to apply a recipe', 400);
    }

    const doc = await recipeService.getRecipe(req.params.id, userId);
    if (!doc) return sendError(res, 'Recipe not found', 404);

    const { tree, targets, niche } = recipeService.recipeToRequest(doc.recipe, {
      videoUrl: body.videoUrl,
      duration: typeof body.duration === 'number' ? body.duration : undefined,
      title: typeof body.title === 'string' ? body.title : doc.name,
      nicheOverride: typeof body.niche === 'string' && body.niche.trim() ? body.niche : undefined,
    });

    if (typeof tree.duration === 'number' && tree.duration > MAX_DURATION_SEC) {
      return sendError(res, 'Source duration cannot exceed 30 minutes per render', 400);
    }

    const result = await repurposeService.orchestrate({ tree, targets, tier, niche, userId });
    if (!result.ok) return sendError(res, result.error, result.status);

    // Count the remix (best-effort) — popularity + attribution.
    recipeService.incrementRemix(doc._id);

    return sendSuccess(res, {
      status: 'queued',
      tier,
      watermarked: enforcement.mustWatermark(tier),
      variantsRequested: result.clampedFrom,
      remixOf: { recipeId: String(doc._id), name: doc.name, by: doc.createdByName },
      variants: result.variants,
    });
  })
);

// Surface unexpected handler errors as JSON (the apply path touches ffmpeg/db).
router.use((err, req, res, _next) => {
  logger.error('[recipes] route error', { error: err.message });
  return sendError(res, 'Recipe request failed', 500);
});

module.exports = router;
