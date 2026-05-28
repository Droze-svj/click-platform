// User settings (notifications, privacy, preferences) - GET/PUT /api/user/settings

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UserSettings = require('../models/UserSettings');

const router = express.Router();

const VIDEO_EDITING_DEFAULTS = {
  preferredVoiceTone: 'Hype',
  preferredHookStyle: 'curiosity-gap',
  pacingIntensity: 'medium',
  captionStyle: 'modern',
  captionFontScale: 1.0,
  captionVerticalOffset: 0,
  aestheticColorGrade: 'vibrant',
  aestheticTransition: 'fade',
  subtitlePosition: 'auto',
  contentTone: 'auto',
  brollFrequency: 'balanced',
  musicGenre: 'auto',
  defaultPlatform: 'auto',
  enableSpeedRamping: true,
  enableBRoll: true,
};

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
      },
      videoEditing: {
        preferredVoiceTone: 'Hype',
        preferredHookStyle: 'curiosity-gap',
        pacingIntensity: 'medium',
        captionStyle: 'modern',
        captionFontScale: 1.0,
        captionVerticalOffset: 0,
        aestheticColorGrade: 'vibrant',
        aestheticTransition: 'fade',
        subtitlePosition: 'auto',
        contentTone: 'auto',
        brollFrequency: 'balanced',
        musicGenre: 'auto',
        defaultPlatform: 'auto',
        enableSpeedRamping: true,
        enableBRoll: true,
      }
    };
  }
  const data = {
    notifications: doc.notifications || {},
    privacy: doc.privacy || {},
    preferences: doc.preferences || {},
    agentic: doc.agentic || {},
    // Merge stored fields over defaults so legacy docs and new fields both appear
    videoEditing: { ...VIDEO_EDITING_DEFAULTS, ...(doc.videoEditing || {}) },
  };
  sendSuccess(res, 'Settings retrieved', 200, data);
}));

/**
 * PUT /api/user/settings
 * Update user settings. Accepts { notifications?, privacy?, preferences?, videoEditing? }.
 */
router.put('/settings', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return sendError(res, 'Unauthorized', 401);
  }
  const { notifications, privacy, preferences, videoEditing } = req.body || {};
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
  if (videoEditing && typeof videoEditing === 'object') {
    // Use field-level keys so a partial save never wipes unrelated videoEditing fields
    Object.entries(videoEditing).forEach(([k, v]) => {
      update[`videoEditing.${k}`] = v;
    });
  }
  const doc = await UserSettings.findOneAndUpdate(
    { userId: String(userId) },
    { $set: update },
    { new: true, upsert: true, runValidators: false }
  ).lean();
  const data = {
    notifications: doc.notifications || {},
    privacy: doc.privacy || {},
    preferences: doc.preferences || {},
    agentic: doc.agentic || {},
    videoEditing: { ...VIDEO_EDITING_DEFAULTS, ...(doc.videoEditing || {}) },
  };
  sendSuccess(res, 'Settings updated', 200, data);
}));

module.exports = router;
