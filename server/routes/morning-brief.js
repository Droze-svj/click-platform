// Morning Brief route
// GET /api/brief/today         — today's brief (no AI call; built from stored data)
// GET /api/brief/subscription  — the caller's delivery preference (or null)
// PUT /api/brief/subscription  — opt in/out of the daily brief and choose when/how
//                                Body: { enabled, timezone (IANA), hour? 0-23,
//                                        channels?: { inApp?, email? } }

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const BriefSubscription = require('../models/BriefSubscription');
const {
  getBriefForUser, isValidTimeZone, briefEnabled, emailDeliveryAvailable, DEFAULT_HOUR,
} = require('../services/morningBriefService');

const shapeSub = (sub) => (sub ? {
  enabled: sub.enabled,
  timezone: sub.timezone,
  hour: sub.hour,
  channels: {
    inApp: !(sub.channels && sub.channels.inApp === false),
    email: Boolean(sub.channels && sub.channels.email),
  },
  lastSentLocalDate: sub.lastSentLocalDate,
} : null);

// deliveryActive: will this server actually send (the cron is opt-in per
// deployment)? emailAvailable: is an email provider configured? The UI uses
// both so it never promises a notification or an email that won't come.
const state = (sub) => ({ subscription: shapeSub(sub), deliveryActive: briefEnabled(), emailAvailable: emailDeliveryAvailable() });

router.get('/today', auth, asyncHandler(async (req, res) => {
  const brief = await getBriefForUser(req.user._id);
  return sendSuccess(res, 'Morning brief', 200, brief);
}));

router.get('/subscription', auth, asyncHandler(async (req, res) => {
  const sub = await BriefSubscription.findOne({ userId: String(req.user._id) }).lean();
  return sendSuccess(res, 'Brief subscription', 200, state(sub));
}));

router.put('/subscription', auth, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const enabled = body.enabled !== false;
  // The global sanitizer escapes "/" to "&#x2F;", which IANA names contain.
  const timezone = typeof body.timezone === 'string' ? body.timezone.replace(/&#x2F;/g, '/') : '';
  if (enabled && !isValidTimeZone(timezone)) return sendError(res, 'A valid IANA timezone is required, e.g. "Europe/Rome"', 400);
  const hourNum = Number.parseInt(body.hour, 10);
  const hour = Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23 ? hourNum : DEFAULT_HOUR;

  const existing = await BriefSubscription.findOne({ userId: String(req.user._id) }).lean();
  const current = shapeSub(existing) || { channels: { inApp: true, email: false } };
  const ch = body.channels && typeof body.channels === 'object' ? body.channels : {};
  const channels = {
    inApp: typeof ch.inApp === 'boolean' ? ch.inApp : current.channels.inApp,
    email: typeof ch.email === 'boolean' ? ch.email : current.channels.email,
  };
  if (enabled && !channels.inApp && !channels.email) return sendError(res, 'Pick at least one way to receive the brief', 400);
  if (enabled && channels.email && !channels.inApp && !emailDeliveryAvailable()) {
    return sendError(res, 'Email delivery is not available on this server yet. Keep in-app on.', 400);
  }

  const set = { enabled, hour, channels };
  if (isValidTimeZone(timezone)) set.timezone = timezone;
  if (!existing && !set.timezone) return sendSuccess(res, 'Brief subscription', 200, state(null));

  const sub = await BriefSubscription.findOneAndUpdate(
    { userId: String(req.user._id) },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  ).lean();
  return sendSuccess(res, enabled ? 'Morning brief scheduled' : 'Morning brief turned off', 200, state(sub));
}));

module.exports = router;
