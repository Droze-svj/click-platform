// Smart suggestions routes

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { generateDailyContentIdeas, analyzeContentGaps } = require('../services/contentSuggestionsService');
const logger = require('../utils/logger');
const router = express.Router();

// Light per-user TTL cache so the "daily" panel doesn't hit the AI on every poll
// (these ideas only need to change ~hourly). In-process; resets on deploy.
const _dailyCache = new Map(); // userId → { value, expires }
const DAILY_TTL_MS = 60 * 60 * 1000;

/**
 * @swagger
 * /api/suggestions/daily:
 *   get:
 *     summary: Get daily content suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/daily', auth, asyncHandler(async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    
    if (!userId) {
      return sendSuccess(res, 'Suggestions fetched', 200, []);
    }

    // Dev users (non-ObjectId ids) have no real content → honest cold-start.
    if (userId.toString().startsWith('dev-') || userId.toString() === 'dev-user-123') {
      return sendSuccess(res, 'Suggestions fetched', 200, []);
    }

    const cacheKey = String(userId);
    const cached = _dailyCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return sendSuccess(res, 'Suggestions fetched', 200, cached.value);
    }

    // REAL personalized ideas (niche + recent-topics aware) + a content-gap nudge.
    // generateDailyContentIdeas degrades to honest fallback ideas internally; it
    // never throws. analyzeContentGaps returns [] when there's nothing to say.
    const [ideas, gaps] = await Promise.all([
      generateDailyContentIdeas(userId, 4).catch(() => []),
      analyzeContentGaps(userId).catch(() => []),
    ]);

    const ideaSuggestions = (Array.isArray(ideas) ? ideas : []).map((idea, i) => {
      const platforms = Array.isArray(idea?.platforms) ? idea.platforms : [];
      const hashtags = Array.isArray(idea?.hashtags) ? idea.hashtags : [];
      const why = [
        platforms.length ? `Best for ${platforms.slice(0, 2).join(', ')}` : null,
        idea?.contentType || null,
      ].filter(Boolean).join(' · ');
      return {
        id: `idea-${i}`,
        type: 'idea',
        title: typeof idea === 'string' ? idea : (idea?.title || 'Content idea'),
        description: (idea && typeof idea === 'object' && idea.description) ? idea.description : '',
        why: why || undefined,
        platforms,
        hashtags,
        action: '/dashboard/content',
        iconType: 'idea',
        priority: i === 0 ? 'high' : 'medium',
      };
    });

    // Surface the single biggest gap (a platform with no/low coverage) — honest:
    // only when there's real content to compare against (gaps is [] otherwise).
    const gap = (Array.isArray(gaps) ? gaps : []).find((g) => g.count === 0) || (Array.isArray(gaps) ? gaps[0] : null);
    const gapSuggestion = gap ? [{
      id: `gap-${gap.platform}`,
      type: 'optimization',
      title: `You're under-posting on ${gap.platform}`,
      description: gap.recommendation || `Add ${gap.platform} to your mix to reach a new audience.`,
      action: '/dashboard/scheduler',
      iconType: 'optimization',
      priority: 'medium',
    }] : [];

    const suggestions = [...ideaSuggestions, ...gapSuggestion];
    _dailyCache.set(cacheKey, { value: suggestions, expires: Date.now() + DAILY_TTL_MS });
    sendSuccess(res, 'Suggestions fetched', 200, suggestions);
  } catch (error) {
    const userId = req.user?._id || req.user?.id;
    logger.error('Error fetching daily suggestions', { error: error.message, stack: error.stack, userId });
    sendSuccess(res, 'Suggestions fetched', 200, []);
  }
}));

// GET /api/suggestions/daily-ideas — the raw personalized idea list (title,
// description, platforms, hashtags, contentType). Honest fallback inside the service.
router.get('/daily-ideas', auth, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return sendSuccess(res, 'Ideas fetched', 200, []);
  const count = Math.max(1, Math.min(10, parseInt(req.query.count, 10) || 5));
  const ideas = await generateDailyContentIdeas(userId, count).catch(() => []);
  return sendSuccess(res, 'Ideas fetched', 200, Array.isArray(ideas) ? ideas : []);
}));

// GET /api/suggestions/content-gaps — platforms the creator is under-posting on.
// Returns [] honestly when there's no content to compare against.
router.get('/content-gaps', auth, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return sendSuccess(res, 'Gaps fetched', 200, []);
  const gaps = await analyzeContentGaps(userId).catch(() => []);
  return sendSuccess(res, 'Gaps fetched', 200, Array.isArray(gaps) ? gaps : []);
}));

// GET /api/suggestions/trending — trending topics for the creator's niche.
router.get('/trending', auth, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return sendSuccess(res, 'Trending fetched', 200, []);
  let niche = (typeof req.query.niche === 'string' && req.query.niche.trim()) || null;
  if (!niche) {
    try {
      const User = require('../models/User');
      const u = await User.findById(userId).select('niche').lean();
      niche = u?.niche || 'general';
    } catch (_) { niche = 'general'; }
  }
  const { getTrendingTopics } = require('../services/contentSuggestionsService');
  const topics = await getTrendingTopics(niche).catch(() => []);
  return sendSuccess(res, 'Trending fetched', 200, Array.isArray(topics) ? topics : []);
}));

module.exports = router;
