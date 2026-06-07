// User settings (notifications, privacy, preferences) - GET/PUT /api/user/settings

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UserSettings = require('../models/UserSettings');
const { encrypt } = require('../utils/dataEncryption');

const router = express.Router();

// Whitelist of integration providers we accept API keys for.
const ALLOWED_INTEGRATION_PROVIDERS = [
  'openai', 'anthropic', 'gemini', 'elevenlabs', 'heygen', 'runway', 'stability', 'replicate'
];

const APPEARANCE_DEFAULTS = { theme: 'auto', density: 'comfortable', reducedMotion: false, accent: '' };
const AI_DEFAULTS = { provider: 'auto', creativity: 0.5, autoApply: false };

// Strip secret material from integrations before sending to the client.
// NEVER return keyCiphertext or the raw key — only provider/label/last4/createdAt.
function maskIntegrations(integrations) {
  return (Array.isArray(integrations) ? integrations : []).map((it) => ({
    provider: it.provider,
    label: it.label || '',
    last4: it.last4 || '',
    createdAt: it.createdAt || null,
  }));
}

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
    appearance: { ...APPEARANCE_DEFAULTS, ...(doc.appearance || {}) },
    ai: { ...AI_DEFAULTS, ...(doc.ai || {}) },
    // Integrations are masked — last4/label/provider only, never the key.
    integrations: maskIntegrations(doc.integrations),
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
  const { appearance, ai } = req.body;
  if (appearance && typeof appearance === 'object') {
    // Field-level merge so partial saves don't wipe sibling fields.
    if (['light', 'dark', 'auto'].includes(appearance.theme)) update['appearance.theme'] = appearance.theme;
    if (['comfortable', 'compact'].includes(appearance.density)) update['appearance.density'] = appearance.density;
    if (typeof appearance.reducedMotion === 'boolean') update['appearance.reducedMotion'] = appearance.reducedMotion;
    if (typeof appearance.accent === 'string') update['appearance.accent'] = appearance.accent.slice(0, 32);
  }
  if (ai && typeof ai === 'object') {
    if (['auto', 'claude', 'gemini'].includes(ai.provider)) update['ai.provider'] = ai.provider;
    if (typeof ai.creativity === 'number' && isFinite(ai.creativity)) {
      update['ai.creativity'] = Math.min(1, Math.max(0, ai.creativity));
    }
    if (typeof ai.autoApply === 'boolean') update['ai.autoApply'] = ai.autoApply;
  }
  // NOTE: integrations are intentionally NOT accepted here — they are managed
  // through the dedicated, validated POST/DELETE routes below so raw keys are
  // never blindly merged from a generic settings payload.
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
    appearance: { ...APPEARANCE_DEFAULTS, ...(doc.appearance || {}) },
    ai: { ...AI_DEFAULTS, ...(doc.ai || {}) },
    integrations: maskIntegrations(doc.integrations),
    videoEditing: { ...VIDEO_EDITING_DEFAULTS, ...(doc.videoEditing || {}) },
  };
  sendSuccess(res, 'Settings updated', 200, data);
}));

/**
 * POST /api/user/settings/integrations
 * Add a third-party API key. Body: { provider, label?, key }.
 * The raw key is encrypted at rest (AES-256-GCM) and NEVER returned.
 */
router.post('/settings/integrations', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);

  const { provider, label, key } = req.body || {};
  if (!provider || typeof provider !== 'string' || !ALLOWED_INTEGRATION_PROVIDERS.includes(provider)) {
    return sendError(res, 'Invalid or unsupported provider', 400);
  }
  if (!key || typeof key !== 'string' || key.trim().length < 8) {
    return sendError(res, 'A valid API key is required', 400);
  }

  const trimmed = key.trim();
  const entry = {
    provider,
    label: typeof label === 'string' ? label.slice(0, 60) : '',
    keyCiphertext: encrypt(trimmed), // { encrypted, iv, tag }
    last4: trimmed.slice(-4),
    createdAt: new Date(),
  };

  // One key per provider: replace any existing entry for the same provider.
  await UserSettings.updateOne(
    { userId: String(userId) },
    { $pull: { integrations: { provider } } },
    { upsert: true }
  );
  const doc = await UserSettings.findOneAndUpdate(
    { userId: String(userId) },
    { $push: { integrations: entry }, $set: { updatedAt: new Date() } },
    { new: true, upsert: true, runValidators: false }
  ).lean();

  sendSuccess(res, 'Integration added', 201, { integrations: maskIntegrations(doc.integrations) });
}));

/**
 * DELETE /api/user/settings/integrations/:provider
 * Remove a stored API key for a provider.
 */
router.delete('/settings/integrations/:provider', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);

  const provider = req.params.provider;
  if (!provider || typeof provider !== 'string') {
    return sendError(res, 'Provider is required', 400);
  }
  const doc = await UserSettings.findOneAndUpdate(
    { userId: String(userId) },
    { $pull: { integrations: { provider } }, $set: { updatedAt: new Date() } },
    { new: true }
  ).lean();

  sendSuccess(res, 'Integration removed', 200, { integrations: maskIntegrations(doc?.integrations) });
}));

module.exports = router;
