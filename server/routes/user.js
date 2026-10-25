// User settings (notifications, privacy, preferences) - GET/PUT /api/user/settings

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UserSettings = require('../models/UserSettings');
const { encrypt, encryptToken, decryptToken, isEncryptedToken } = require('../utils/dataEncryption');
const validator = require('validator');

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

// agentic.heygenApiKey / soraApiKey are third-party secrets. GET used to
// return them in plaintext; now the client only learns whether one is saved
// and its last 4 characters. At rest they are encrypted (enc:v1:, the OAuth
// token format); rows saved before that are plaintext and still read fine.
const AGENTIC_SECRET_FIELDS = ['heygenApiKey', 'soraApiKey'];
function maskAgentic(agentic) {
  const out = { ...(agentic || {}) };
  for (const field of AGENTIC_SECRET_FIELDS) {
    const stored = typeof out[field] === 'string' ? out[field] : '';
    const value = stored ? String(decryptToken(stored) || '') : '';
    delete out[field];
    out[`${field}Set`] = value.length > 0;
    out[`${field}Last4`] = value.length >= 8 ? value.slice(-4) : '';
  }
  return out;
}

const NOTIFICATION_BOOLEANS = ['email', 'push', 'contentReady', 'weeklyDigest', 'achievements', 'mentions', 'comments'];
const NOTIFICATION_CHANNELS = ['inApp', 'email'];
const NOTIFICATION_CATEGORIES = ['task', 'project', 'content', 'approval', 'mention', 'system', 'workflow'];

// Field-level $set paths for a notifications payload. Replacing the whole
// sub-object meant any client holding stale or default values (e.g. after a
// failed load) silently overwrote every other notification setting.
function notificationUpdates(n) {
  const out = {};
  for (const k of NOTIFICATION_BOOLEANS) if (typeof n[k] === 'boolean') out[`notifications.${k}`] = n[k];
  if (['high_only', 'high_medium', 'all'].includes(n.priorityTiers)) out['notifications.priorityTiers'] = n.priorityTiers;
  if (['immediate', 'daily', 'weekly'].includes(n.digestMode)) out['notifications.digestMode'] = n.digestMode;
  if (typeof n.digestTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(n.digestTime)) out['notifications.digestTime'] = n.digestTime;
  if (n.channels && typeof n.channels === 'object') {
    for (const k of NOTIFICATION_CHANNELS) if (typeof n.channels[k] === 'boolean') out[`notifications.channels.${k}`] = n.channels[k];
  }
  if (n.categories && typeof n.categories === 'object') {
    for (const k of NOTIFICATION_CATEGORIES) if (typeof n.categories[k] === 'boolean') out[`notifications.categories.${k}`] = n.categories[k];
  }
  return out;
}

// Same for agentic. A secret is only written when a new non-empty value is
// sent; omitting it (the client never has the saved key) keeps the stored one,
// and null clears it.
function agenticUpdates(a) {
  const out = {};
  if (typeof a.autonomousSwarm === 'boolean') out['agentic.autonomousSwarm'] = a.autonomousSwarm;
  if (typeof a.slaAutoFulfill === 'boolean') out['agentic.slaAutoFulfill'] = a.slaAutoFulfill;
  if (typeof a.predictiveThreshold === 'number' && Number.isFinite(a.predictiveThreshold)) {
    out['agentic.predictiveThreshold'] = Math.min(100, Math.max(0, a.predictiveThreshold));
  }
  if (['heygen', 'sora', 'both'].includes(a.digitalTwinProvider)) out['agentic.digitalTwinProvider'] = a.digitalTwinProvider;
  for (const field of AGENTIC_SECRET_FIELDS) {
    if (a[field] === null) out[`agentic.${field}`] = '';
    // Undo the input sanitizer's HTML-escaping: keys can contain `/` or `+`.
    else if (typeof a[field] === 'string' && a[field].trim()) {
      out[`agentic.${field}`] = encryptToken(validator.unescape(a[field].trim()).slice(0, 512));
    }
  }
  return out;
}

// A key saved before encryption at rest is plaintext. Any settings save
// re-encrypts it, so old rows converge without a migration.
function reencryptLegacySecrets(existingAgentic, update) {
  for (const field of AGENTIC_SECRET_FIELDS) {
    const path = `agentic.${field}`;
    if (path in update) continue;
    const stored = existingAgentic && existingAgentic[field];
    if (typeof stored === 'string' && stored && !isEncryptedToken(stored)) {
      update[path] = encryptToken(stored);
    }
  }
}

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
    agentic: maskAgentic(doc.agentic),
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
    Object.assign(update, notificationUpdates(notifications));
  }
  if (privacy && typeof privacy === 'object') {
    for (const k of ['dataConsent', 'marketingConsent', 'analyticsConsent']) {
      if (typeof privacy[k] === 'boolean') update[`privacy.${k}`] = privacy[k];
    }
  }
  if (preferences && typeof preferences === 'object') {
    // Field-level merge, not wholesale replacement: `update.preferences = …`
    // meant a client sending only { theme } silently wiped language, timezone
    // and the workspace personalization below.
    if (typeof preferences.theme === 'string') update['preferences.theme'] = preferences.theme;
    if (typeof preferences.language === 'string') update['preferences.language'] = preferences.language;
    if (typeof preferences.timezone === 'string') update['preferences.timezone'] = preferences.timezone;
    if (typeof preferences.lastUsedWorkflowTemplateId === 'string') {
      update['preferences.lastUsedWorkflowTemplateId'] = preferences.lastUsedWorkflowTemplateId;
    }
    // Pinned nav paths — clamped in count and length, and restricted to
    // in-app dashboard routes so this can't be used to store arbitrary data
    // or smuggle an off-site URL into the user's own sidebar.
    if (Array.isArray(preferences.pinnedNav)) {
      update['preferences.pinnedNav'] = preferences.pinnedNav
        .filter((p) => typeof p === 'string' && /^\/dashboard(\/[A-Za-z0-9\-_/[\]]*)?$/.test(p))
        .slice(0, 24);
    }
    if (typeof preferences.defaultLanding === 'string') {
      const landing = preferences.defaultLanding;
      update['preferences.defaultLanding'] =
        landing === '' || /^\/dashboard(\/[A-Za-z0-9\-_/[\]]*)?$/.test(landing) ? landing : '';
    }
  }
  if (req.body.agentic && typeof req.body.agentic === 'object') {
    try {
      Object.assign(update, agenticUpdates(req.body.agentic));
    } catch (err) {
      // encryptToken refuses to store a key in plaintext (production without
      // a valid ENCRYPTION_KEY). Say so instead of a bare 500.
      return sendError(res, 'API keys cannot be stored securely right now. Nothing was saved; try again later.', 503);
    }
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
  try {
    const existing = await UserSettings.findOne({ userId: String(userId) }).select('agentic.heygenApiKey agentic.soraApiKey').lean();
    reencryptLegacySecrets(existing?.agentic, update);
  } catch (_) { /* best-effort; the save itself still runs */ }
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
    agentic: maskAgentic(doc.agentic),
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
