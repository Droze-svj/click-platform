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

module.exports = router;
module.exports.scheduleDeps = scheduleDeps;
