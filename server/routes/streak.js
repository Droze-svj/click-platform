// Posting Streak route — GET /api/streak?unit=week|day

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const ScheduledPost = require('../models/ScheduledPost');
const { getStreak } = require('../services/postingStreakService');

// Look up the caller's posted-content timestamps (postedAt, falling back to the
// scheduled time), capped so a huge history can't blow up the query.
async function getPostDates(userId) {
  const ids = [userId, userId && userId.toString()].filter(Boolean);
  const rows = await ScheduledPost.find({ userId: { $in: ids }, status: 'posted' })
    .select('postedAt scheduledTime')
    .sort({ scheduledTime: -1 })
    .limit(2000)
    .lean();
  return rows.map((r) => r.postedAt || r.scheduledTime).filter(Boolean);
}

/**
 * GET /api/streak?unit=week|day
 * The caller's posting streak: consecutive periods with ≥1 post, longest streak,
 * this-period count, and an active/at-risk/broken status.
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const unit = req.query.unit === 'day' ? 'day' : 'week';
  const streak = await getStreak(req.user._id, { unit }, { getPostDates });
  sendSuccess(res, 'Streak computed', 200, streak);
}));

module.exports = router;
