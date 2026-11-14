/**
 * /api/post-results — the creator tells Click how a published video did.
 *
 *   GET    /api/post-results            the creator's measured posts + how each did vs their own typical views
 *   POST   /api/post-results            log (or update) the numbers for one video on one platform
 *   DELETE /api/post-results/:id        remove a result the creator logged by hand
 *
 * Why this exists: the learning loop (performanceLearningCron → UserStyleProfile)
 * only learns from posts that have measured results. Platform syncs need each
 * platform's OAuth app; a creator who exports from Click and posts by hand had
 * no way to feed their numbers back, so Click never learned from those videos.
 *
 * Writes go to the same ScheduledPost rows the platform sync fills, with
 * `analytics.lastUpdated` stamped only when a number moved — the 6h cron stays
 * the single learning writer and picks the row up on its next pass.
 */

const express = require('express');
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { guardOwnership } = require('../utils/ownership');
const { mongoUserId } = require('../utils/userKey');
const logger = require('../utils/logger');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const { getViewsBaseline } = require('../services/creatorPerformanceService');

const router = express.Router();

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit'];
const MAX_COUNT = 1e10;
const MANUAL_SOURCE = 'manual-results';

/** Non-negative whole number, or undefined when absent. Throws on garbage. */
function count(v, name) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_COUNT) {
    throw new RangeError(`${name} must be a number between 0 and ${MAX_COUNT}`);
  }
  return Math.round(n);
}

function percent(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new RangeError('avgWatchPercent must be between 0 and 100');
  return Math.round(n * 10) / 10;
}

/** Only http(s) links, stored as text — never fetched (no SSRF surface). */
function postUrl(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string' || v.length > 500) throw new RangeError('postUrl must be a link under 500 characters');
  let u;
  try { u = new URL(v.trim()); } catch { throw new RangeError('postUrl must be a valid link'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new RangeError('postUrl must start with http(s)://');
  return u.toString();
}

function postedAtDate(v) {
  if (v === undefined || v === null || v === '') return new Date();
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new RangeError('postedAt must be a date');
  if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) throw new RangeError('postedAt cannot be in the future');
  if (d.getTime() < Date.UTC(2005, 0, 1)) throw new RangeError('postedAt is too far in the past');
  return d;
}

/** How a post compares with the creator's own typical views on that platform. */
async function compare(userId, platform, views, excludeId) {
  const { medianViews, sampleSize } = await getViewsBaseline(userId, platform, excludeId);
  if (!medianViews || !(views > 0)) {
    return { medianViews: null, ratio: null, sampleSize, needMorePosts: Math.max(0, 3 - sampleSize) };
  }
  return { medianViews, ratio: Math.round((views / medianViews) * 100) / 100, sampleSize, needMorePosts: 0 };
}

function shape(post, title) {
  const a = post.analytics || {};
  return {
    id: String(post._id),
    contentId: post.contentId,
    title: title || null,
    platform: post.platform,
    postedAt: post.postedAt || post.scheduledTime,
    postUrl: post.metadata?.postUrl || null,
    source: post.metadata?.source === MANUAL_SOURCE ? 'manual' : 'platform',
    views: a.views || 0,
    likes: a.likes || 0,
    comments: a.comments || 0,
    shares: a.shares || 0,
    saves: a.saves || 0,
    avgWatchPercent: a.watchTime?.averagePercentage ?? null,
    learnedAt: post.lastLearnedAt || null,
    updatedAt: a.lastUpdated || null,
  };
}

router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = mongoUserId(req);
  if (!userId) return sendError(res, 'Unauthenticated', 401);
  const filter = { userId: String(userId), status: 'posted', 'analytics.views': { $gt: 0 } };
  if (typeof req.query.contentId === 'string' && req.query.contentId) filter.contentId = req.query.contentId;
  const posts = await ScheduledPost.find(filter).sort({ postedAt: -1 }).limit(50).lean();

  const contentIds = [...new Set(posts.map((p) => p.contentId).filter((id) => mongoose.isValidObjectId(id)))];
  const titles = new Map();
  if (contentIds.length) {
    const rows = await Content.find({ _id: { $in: contentIds } }).select('title').lean();
    for (const r of rows) titles.set(String(r._id), r.title);
  }

  // Each post vs the median of the creator's posts on that platform (this one included
  // in the pool — it's a listing, not a fresh result).
  const medians = new Map();
  for (const platform of [...new Set(posts.map((p) => p.platform))]) {
    medians.set(platform, (await getViewsBaseline(userId, platform)).medianViews);
  }
  const results = posts.map((p) => {
    const median = medians.get(p.platform);
    const views = p.analytics?.views || 0;
    return {
      ...shape(p, titles.get(String(p.contentId))),
      vsTypical: median && views ? Math.round((views / median) * 100) / 100 : null,
    };
  });
  return sendSuccess(res, { results, typicalViews: Object.fromEntries(medians) });
}));

router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = mongoUserId(req);
  if (!userId) return sendError(res, 'Unauthenticated', 401);
  const body = req.body || {};
  const platform = typeof body.platform === 'string' ? body.platform.toLowerCase() : '';
  if (!PLATFORMS.includes(platform)) return sendError(res, `platform must be one of: ${PLATFORMS.join(', ')}`, 400);

  let input;
  try {
    input = {
      views: count(body.views, 'views'),
      likes: count(body.likes, 'likes'),
      comments: count(body.comments, 'comments'),
      shares: count(body.shares, 'shares'),
      saves: count(body.saves, 'saves'),
      avgWatchPercent: percent(body.avgWatchPercent),
      postUrl: postUrl(body.postUrl),
      postedAt: postedAtDate(body.postedAt),
    };
  } catch (err) {
    if (err instanceof RangeError) return sendError(res, err.message, 400);
    throw err;
  }
  if (!(input.views > 0)) return sendError(res, 'views is required and must be more than 0', 400);

  const contentId = typeof body.contentId === 'string' ? body.contentId : '';
  const content = await guardOwnership(req, res, contentId);
  if (!content) return undefined;

  const uid = String(userId);
  // The video on this platform may already have a row (Click published it, or the
  // creator logged it before): update that one instead of double-counting the video.
  let post = await ScheduledPost.findOne({ userId: uid, contentId, platform, status: 'posted' }).sort({ postedAt: -1 });
  const isNew = !post;
  if (isNew) {
    post = new ScheduledPost({
      userId: uid,
      contentId,
      platform,
      status: 'posted',
      scheduledTime: input.postedAt,
      postedAt: input.postedAt,
      niche: content.niche || content.metadata?.niche || null,
      content: { text: typeof content.title === 'string' ? content.title.slice(0, 300) : undefined },
      metadata: { source: MANUAL_SOURCE },
    });
  }

  const prev = (isNew ? {} : post.toObject().analytics) || {};
  const next = {
    views: input.views,
    likes: input.likes ?? prev.likes ?? 0,
    comments: input.comments ?? prev.comments ?? 0,
    shares: input.shares ?? prev.shares ?? 0,
    saves: input.saves ?? prev.saves ?? 0,
  };
  const engagement = next.likes + next.comments + next.shares + next.saves;
  const avgPct = input.avgWatchPercent ?? prev.watchTime?.averagePercentage ?? null;
  const moved = isNew
    || ['views', 'likes', 'comments', 'shares', 'saves'].some((k) => (Number(prev[k]) || 0) !== next[k])
    || (prev.watchTime?.averagePercentage ?? null) !== avgPct;

  post.analytics = {
    ...prev,
    ...next,
    // The posting-time and slip-alert services rate posts as engagement / reach.
    reach: Math.max(Number(prev.reach) || 0, input.views),
    impressions: Math.max(Number(prev.impressions) || 0, input.views),
    videoViews: input.views,
    engagement,
    engagementBreakdown: {
      ...(prev.engagementBreakdown || {}),
      likes: next.likes,
      comments: next.comments,
      shares: next.shares,
      saves: next.saves,
      views: input.views,
    },
    engagementRate: {
      ...(prev.engagementRate || {}),
      byReach: Math.round((engagement / input.views) * 10000) / 100,
    },
    watchTime: { ...(prev.watchTime || {}), averagePercentage: avgPct },
    // Only a real change re-queues the post for the learning cron.
    lastUpdated: moved ? new Date() : (prev.lastUpdated || new Date()),
  };
  post.markModified('analytics');
  if (input.postUrl || isNew) {
    post.metadata = { ...(post.metadata || {}), ...(input.postUrl ? { postUrl: input.postUrl } : {}) };
    post.markModified('metadata');
  }
  if (isNew || post.metadata?.source === MANUAL_SOURCE) post.postedAt = input.postedAt;
  await post.save();

  const comparison = await compare(userId, platform, input.views, post._id);
  logger.info('Post results logged', { userId: uid, platform, isNew, moved });
  return sendSuccess(res, {
    result: shape(post, content.title),
    comparison,
    // The 6h learning pass is the only writer of the style profile; say so honestly.
    learning: moved ? 'queued' : 'unchanged',
  }, isNew ? 201 : 200);
}));

router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const userId = mongoUserId(req);
  if (!userId) return sendError(res, 'Unauthenticated', 401);
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 'Result not found', 404);
  // Only rows the creator typed in — a published post's platform data isn't theirs to delete here.
  const out = await ScheduledPost.deleteOne({
    _id: req.params.id,
    userId: String(userId),
    'metadata.source': MANUAL_SOURCE,
  });
  if (!out.deletedCount) return sendError(res, 'Result not found', 404);
  return sendSuccess(res, { deleted: true });
}));

module.exports = router;
module.exports._test = { count, percent, postUrl, postedAtDate };
