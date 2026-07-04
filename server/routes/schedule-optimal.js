// Optimal-Time Auto-Schedule routes
// GET /api/schedule/optimal-slots?platform=&count= → suggested posting times.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const { clampInt } = require('../utils/pagination');
const User = require('../models/User');
const contentPerformance = require('../services/contentPerformanceService');
const { NICHE_POSTING_WINDOWS } = require('../services/marketingKnowledge');
const { computeOptimalSlots } = require('../services/optimalScheduleService');
const { getHeatmap } = require('../services/postingHeatmapService');

// Deps wiring shared by this route and the calendar-autofill integration.
function scheduleDeps() {
  return {
    getHistory: (uid, platform) => contentPerformance.getOptimalPostingTimes(uid, platform),
    getNiche: async (uid) => {
      const u = await User.findById(uid).select('niche').lean();
      return (u && u.niche) || 'other';
    },
    nicheWindows: (niche) => NICHE_POSTING_WINDOWS[niche] || NICHE_POSTING_WINDOWS.other || [],
  };
}

/**
 * GET /api/schedule/optimal-slots?platform=&count=
 * Suggest `count` future posting times for the caller on a platform, ranked from
 * their own engagement history (or niche defaults when there isn't enough data).
 */
router.get('/optimal-slots', auth, asyncHandler(async (req, res) => {
  const platform = req.query.platform ? String(req.query.platform) : 'tiktok';
  const count = clampInt(req.query.count, 7, 30, 1);
  const result = await computeOptimalSlots(req.user._id, platform, count, scheduleDeps());
  sendSuccess(res, 'Optimal slots computed', 200, result);
}));

/**
 * GET /api/schedule/heatmap?platform=
 * A 7×24 engagement heatmap of the caller's posted content — when their audience
 * actually engages, plus the single peak cell.
 */
router.get('/heatmap', auth, asyncHandler(async (req, res) => {
  const platform = req.query.platform ? String(req.query.platform) : null;
  const ScheduledPost = require('../models/ScheduledPost');
  const heatmap = await getHeatmap(req.user._id, {
    getPosts: async (uid) => {
      const ids = [uid, uid && uid.toString()].filter(Boolean);
      const q = { userId: { $in: ids }, status: 'posted' };
      if (platform) q.platform = String(platform);
      const rows = await ScheduledPost.find(q)
        .select('postedAt scheduledTime analytics.engagement')
        .sort({ scheduledTime: -1 })
        .limit(2000)
        .lean();
      return rows.map((r) => ({
        postedAt: r.postedAt || r.scheduledTime,
        engagement: (r.analytics && r.analytics.engagement) || 0,
      }));
    },
  });
  sendSuccess(res, 'Heatmap computed', 200, heatmap);
}));

module.exports = router;
module.exports.scheduleDeps = scheduleDeps;
