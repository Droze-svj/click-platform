// Growth & SEO routes — native vidIQ-class packaging optimization. Score a
// video's SEO, get an AI rewrite, and (the closed loop) apply the optimized
// metadata straight back onto the content.

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { aiLimiter } = require('../middleware/enhancedRateLimiter');
const { sendSuccess, sendError } = require('../utils/response');
const Content = require('../models/Content');
const { scoreVideoSeo, generateSeoRewrite } = require('../services/seoScorecardService');
const { getKeywordIdeas } = require('../services/keywordIntelService');
const { getOutliers } = require('../services/velocityOutlierService');
const { getRetentionInsights, getExternalVideoRetention } = require('../services/retentionAnalysisService');
const { getChannelAudit } = require('../services/channelAuditService');
const { getContentGrowthBrief } = require('../services/growthBriefService');
const { syncYouTubeVideos, listVideos } = require('../services/socialVideoSyncService');

const router = express.Router();

// Resolve the metadata to score: either an owned Content doc or a raw payload.
async function resolveMeta(req) {
  const { contentId } = req.body || {};
  if (contentId) {
    const content = await Content.findById(contentId).select('userId title description tags metadata thumbnailUrl').lean();
    if (!content) { const e = new Error('Content not found'); e.statusCode = 404; throw e; }
    if (String(content.userId) !== String(req.user._id)) { const e = new Error('Content not found'); e.statusCode = 404; throw e; }
    return {
      contentId,
      meta: {
        title: content.title,
        description: content.description,
        tags: content.tags,
        thumbnail: (content.metadata && content.metadata.thumbnail) || content.thumbnailUrl || null,
      },
    };
  }
  const { title, description, tags, thumbnail } = req.body || {};
  return { contentId: null, meta: { title, description, tags, thumbnail } };
}

// POST /api/seo/scorecard — score a video's packaging (0–100 + fixes).
router.post('/scorecard', auth, asyncHandler(async (req, res) => {
  const { meta, contentId } = await resolveMeta(req);
  const card = scoreVideoSeo(meta, { targetKeyword: req.body.targetKeyword, platform: req.body.platform });
  sendSuccess(res, 'SEO scorecard', 200, { ...card, contentId });
}));

// POST /api/seo/rewrite — AI-optimized title/description/tags (suggestion only).
// aiLimiter: this spends LLM tokens, so gate it tighter than the global limiter.
router.post('/rewrite', auth, aiLimiter, asyncHandler(async (req, res) => {
  const { meta, contentId } = await resolveMeta(req);
  const before = scoreVideoSeo(meta, { targetKeyword: req.body.targetKeyword, platform: req.body.platform });
  const rewrite = await generateSeoRewrite(meta, {
    targetKeyword: req.body.targetKeyword, platform: req.body.platform, userId: req.user._id,
  });
  const after = scoreVideoSeo(rewrite, { targetKeyword: req.body.targetKeyword, platform: req.body.platform });
  sendSuccess(res, 'SEO rewrite', 200, {
    contentId,
    suggestion: rewrite,
    scoreBefore: before.score,
    scoreAfter: after.score,
    improvement: after.score - before.score,
  });
}));

// POST /api/seo/apply — apply optimized metadata onto an owned content (closed loop).
router.post('/apply', auth, asyncHandler(async (req, res) => {
  const { contentId, title, description, tags } = req.body || {};
  if (!contentId) return sendError(res, 'contentId is required', 400);
  const content = await Content.findById(contentId);
  if (!content || String(content.userId) !== String(req.user._id)) return sendError(res, 'Content not found', 404);

  const applied = {};
  if (typeof title === 'string' && title.trim()) { content.title = title.trim().slice(0, 200); applied.title = content.title; }
  if (typeof description === 'string') { content.description = description; applied.description = true; }
  if (Array.isArray(tags)) { content.tags = tags.map((t) => String(t)).filter(Boolean).slice(0, 30); applied.tags = content.tags; }
  await content.save();
  sendSuccess(res, 'SEO metadata applied', 200, { contentId, applied });
}));

// GET /api/seo/keywords?seed=...&platform=... — scored keyword ideas.
// aiLimiter: hits external autocomplete + an AI competition call (cached 6h).
router.get('/keywords', auth, aiLimiter, asyncHandler(async (req, res) => {
  const seed = String(req.query.seed || '').trim();
  if (!seed) return sendError(res, 'seed is required', 400);
  const result = await getKeywordIdeas(seed, {
    platform: String(req.query.platform || 'youtube').toLowerCase(),
    limit: Number(req.query.limit) || 15,
    userId: req.user._id,
  });
  sendSuccess(res, 'Keyword ideas', 200, result);
}));

// GET /api/seo/outliers — videos overperforming the creator's own baseline.
router.get('/outliers', auth, asyncHandler(async (req, res) => {
  const result = await getOutliers(req.user._id, {
    overMultiplier: Number(req.query.overMultiplier) || 2,
    limit: Number(req.query.limit) || 100,
  });
  sendSuccess(res, 'Performance outliers', 200, result);
}));

// GET /api/seo/retention/:contentId — retention curve → edit recommendations.
router.get('/retention/:contentId', auth, asyncHandler(async (req, res) => {
  const result = await getRetentionInsights(req.params.contentId, req.user._id, { accountId: req.query.accountId || null });
  sendSuccess(res, 'Retention insights', 200, result);
}));

// GET /api/seo/video-retention/:externalId — retention for ANY synced channel
// video (incl. videos published outside Click). Ownership via SocialVideo.
router.get('/video-retention/:externalId', auth, asyncHandler(async (req, res) => {
  const result = await getExternalVideoRetention(req.params.externalId, req.user._id, { accountId: req.query.accountId || null });
  sendSuccess(res, 'Video retention insights', 200, result);
}));

// GET /api/seo/brief/:contentId — the closed-loop "do this next" brief.
router.get('/brief/:contentId', auth, asyncHandler(async (req, res) => {
  const brief = await getContentGrowthBrief(req.params.contentId, req.user._id, {
    targetKeyword: req.query.keyword, platform: req.query.platform, accountId: req.query.accountId || null,
  });
  sendSuccess(res, 'Growth brief', 200, brief);
}));

// GET /api/seo/channel-audit?days=&accountId= — channel-level scorecard from
// real YouTube data, per connected account (accountId). aiLimiter + 1h cache
// protect the YouTube Data API quota.
router.get('/channel-audit', auth, aiLimiter, asyncHandler(async (req, res) => {
  const result = await getChannelAudit(req.user._id, {
    days: Number(req.query.days) || 28,
    accountId: req.query.accountId || null,
  });
  sendSuccess(res, 'Channel audit', 200, result);
}));

// POST /api/seo/sync — import/refresh the user's channel videos (Click + external)
// into the canonical SocialVideo store. aiLimiter: hits the YouTube API.
router.post('/sync', auth, aiLimiter, asyncHandler(async (req, res) => {
  const result = await syncYouTubeVideos(req.user._id, { accountId: req.body && req.body.accountId });
  sendSuccess(res, 'Video sync', 200, result);
}));

// GET /api/seo/videos?accountId= — list the user's synced videos (for pickers).
router.get('/videos', auth, asyncHandler(async (req, res) => {
  const result = await listVideos(req.user._id, {
    accountId: req.query.accountId || null,
    limit: Number(req.query.limit) || 50,
  });
  sendSuccess(res, 'Synced videos', 200, result);
}));

module.exports = router;
