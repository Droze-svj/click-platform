// User settings (notifications, privacy, preferences) - GET/PUT /api/user/settings

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UserSettings = require('../models/UserSettings');

const router = express.Router();

function getUserId(req) {
  return req.user?.id || req.user?._id?.toString?.() || req.user?._id;
}

/**
 * GET /api/user/settings
 * Get current user settings (notifications, privacy, preferences).
 */
router.get('/settings', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return sendError(res, 'Unauthorized', 401);
  }
  let doc = await UserSettings.findOne({ userId: String(userId) }).lean();
  if (!doc) {
    doc = {
      notifications: {
        email: true,
        push: true,
        contentReady: true,
        weeklyDigest: false,
        achievements: true,
        mentions: true,
        comments: false,
        priorityTiers: 'all',
        digestMode: 'immediate',
        digestTime: '09:00'
      },
      privacy: { dataConsent: true, marketingConsent: false, analyticsConsent: true },
      preferences: { theme: 'auto', language: 'en', timezone: '' },
      agentic: {
        autonomousSwarm: true,
        slaAutoFulfill: true,
        predictiveThreshold: 85,
        digitalTwinProvider: 'both'
      }
    };
  }
  const data = {
    notifications: doc.notifications || {},
    privacy: doc.privacy || {},
    preferences: doc.preferences || {},
    agentic: doc.agentic || {}
  };
  sendSuccess(res, 'Settings retrieved', 200, data);
}));

/**
 * PUT /api/user/settings
 * Update user settings. Accepts { notifications?, privacy?, preferences? }.
 */
router.put('/settings', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return sendError(res, 'Unauthorized', 401);
  }
  const { notifications, privacy, preferences } = req.body || {};
  const update = { updatedAt: new Date() };
  if (notifications && typeof notifications === 'object') {
    update.notifications = notifications;
  }
  if (privacy && typeof privacy === 'object') {
    update.privacy = privacy;
  }
  if (preferences && typeof preferences === 'object') {
    update.preferences = preferences;
  }
  if (req.body.agentic && typeof req.body.agentic === 'object') {
    update.agentic = req.body.agentic;
  }
  const doc = await UserSettings.findOneAndUpdate(
    { userId: String(userId) },
    { $set: update },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  const data = {
    notifications: doc.notifications || {},
    privacy: doc.privacy || {},
    preferences: doc.preferences || {},
    agentic: doc.agentic || {}
  };
  sendSuccess(res, 'Settings updated', 200, data);
}));

module.exports = router;
