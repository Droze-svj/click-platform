/**
 * GET /api/analytics/creator/stats
 *
 * Returns per-post performance stats for the current creator.
 * Pulls from ScheduledPost (real engagement data written by social services)
 * and Content (metadata + viral scores from AI processing).
 *
 * Response shape the frontend expects:
 * { stats: [{ id, title, platform, views, likes, shares, comments,
 *             completionRate, viralScore, engagementRate, status, publishedAt }] }
 */

const express = require('express');
const auth = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const logger = require('../../utils/logger');
const router = express.Router();

router.get('/stats', auth, asyncHandler(async (req, res) => {
  const userId = req.user._id || req.user.id;
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);

  try {
    const ScheduledPost = require('../../models/ScheduledPost');
    const Content = require('../../models/Content');

    // Pull published posts with real engagement data
    const posts = await ScheduledPost.find({
      userId,
      status: 'posted',
    })
      .sort({ postedAt: -1 })
      .limit(limit)
      .lean();

    // Build a lookup from contentId → Content doc for title + viralScore
    const contentIds = posts
      .map(p => p.contentId)
      .filter(Boolean);

    const contentDocs = contentIds.length
      ? await Content.find({ _id: { $in: contentIds } })
        .select('title generatedContent analytics')
        .lean()
      : [];

    const contentMap = {};
    for (const c of contentDocs) {
      contentMap[String(c._id)] = c;
    }

    const stats = posts.map(post => {
      const content = contentMap[String(post.contentId)] || {};
      const eb = post.analytics?.engagementBreakdown || {};
      const views = eb.views || post.analytics?.engagement || 0;
      const likes = eb.likes || 0;
      const shares = eb.shares || 0;
      const comments = eb.comments || 0;
      const totalEngagement = likes + shares + comments;
      const engagementRate = views > 0
        ? parseFloat(((totalEngagement / views) * 100).toFixed(2))
        : 0;

      // viralScore comes from AI clip analysis stored on the content doc
      const clips = content.generatedContent?.shortVideos || [];
      const avgViral = clips.length
        ? clips.reduce((s, c) => s + (c.viralScore || 0), 0) / clips.length
        : (content.analytics?.engagement ? Math.min(10, content.analytics.engagement / 1000) : 0);

      return {
        id: String(post._id),
        contentId: post.contentId ? String(post.contentId) : null,
        title: content.title || post.content?.text?.slice(0, 80) || 'Untitled post',
        platform: post.platform,
        views,
        likes,
        shares,
        comments,
        engagementRate,
        completionRate: post.analytics?.completionRate ?? 55,
        viralScore: parseFloat((avgViral || 0).toFixed(1)),
        status: post.status,
        publishedAt: post.postedAt || post.updatedAt,
      };
    });

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Creator stats fetch failed', { userId, error: error.message });
    // Graceful degradation — return empty instead of 500 so the UI renders
    res.json({ success: true, stats: [], isFallback: true });
  }
}));

module.exports = router;
