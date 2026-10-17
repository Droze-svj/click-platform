// Morning Brief route
// GET /api/brief/today         — today's brief (no AI call; built from stored data)
// GET /api/brief/subscription  — the caller's delivery preference (or null)
// PUT /api/brief/subscription  — opt in/out of the daily in-app brief
//                                Body: { enabled, timezone (IANA), hour? 0-23 }

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const BriefSubscription = require('../models/BriefSubscription');
const { getBriefForUser, isValidTimeZone, briefEnabled, DEFAULT_HOUR } = require('../services/morningBriefService');

const shapeSub = (sub) => (sub ? {
  enabled: sub.enabled, timezone: sub.timezone, hour: sub.hour, lastSentLocalDate: sub.lastSentLocalDate,
} : null);

router.get('/today', auth, asyncHandler(async (req, res) => {
  const brief = await getBriefForUser(req.user._id);
  return sendSuccess(res, 'Morning brief', 200, brief);
}));

router.get('/subscription', auth, asyncHandler(async (req, res) => {
  const sub = await BriefSubscription.findOne({ userId: String(req.user._id) }).lean();
  // deliveryActive tells the UI whether the server will actually send (the cron
  // is opt-in per deployment), so it never promises a notification that won't come.
  return sendSuccess(res, 'Brief subscription', 200, { subscription: shapeSub(sub), deliveryActive: briefEnabled() });
}));

router.put('/subscription', auth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const enabled = body.enabled !== false;
  // The global sanitizer escapes "/" to "&#x2F;", which IANA names contain.
  const timezone = typeof body.timezone === 'string' ? body.timezone.replace(/&#x2F;/g, '/') : '';
  if (enabled && !isValidTimeZone(timezone)) return sendError(res, 'A valid IANA timezone is required, e.g. "Europe/Rome"', 400);
  const hourNum = Number.parseInt(body.hour, 10);
  const hour = Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23 ? hourNum : DEFAULT_HOUR;

  const set = { enabled, hour };
  if (isValidTimeZone(timezone)) set.timezone = timezone;
  const existing = await BriefSubscription.findOne({ userId: String(req.user._id) }).lean();
  if (!existing && !set.timezone) return sendSuccess(res, 'Brief subscription', 200, { subscription: null, deliveryActive: briefEnabled() });

  const sub = await BriefSubscription.findOneAndUpdate(
    { userId: String(req.user._id) },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
  return sendSuccess(res, enabled ? 'Morning brief scheduled' : 'Morning brief turned off', 200, {
    subscription: shapeSub(sub), deliveryActive: briefEnabled(),
  });
}));

module.exports = router;
