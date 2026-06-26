// Saved editor "looks" — POST/GET/DELETE /api/editor/presets
//
// Persists a creator's current editor look (filters + color grade + audio mix +
// caption style) as a named, reusable preset in UserPreferences.presets[]. Per-user
// scoped; the `settings` payload is KEY-ALLOWLISTED (no mass-assignment / prototype
// pollution) and the count is capped. The stored filter/audio objects are re-sanitized
// at render time, so storing them raw is safe.

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const UserPreferences = require('../models/UserPreferences');
const { isDevUser } = require('../utils/devUser');
const logger = require('../utils/logger');

const router = express.Router();

const MAX_LOOKS = 50;
const CATEGORY = 'editor-look';
const ALLOWED_SETTING_KEYS = ['filters', 'colorGrade', 'audio', 'captionStyle', 'layout'];

function uid(req) { return req.user?._id || req.user?.id; }

// Copy ONLY allowlisted keys; coerce scalars, pass objects through (re-sanitized at
// render). This is the mass-assignment / prototype-pollution guard.
function sanitizeSettings(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of ALLOWED_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
    const v = raw[k];
    if (k === 'colorGrade' || k === 'captionStyle' || k === 'layout') {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 80);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = v;
    }
  }
  return out;
}

function shape(p) {
  return { id: p.id, name: p.name, settings: p.settings || {}, createdAt: p.createdAt };
}

// GET — the creator's saved looks
router.get('/presets', auth, asyncHandler(async (req, res) => {
  const userId = uid(req);
  if (!userId || isDevUser(userId)) return sendSuccess(res, { presets: [] });
  let prefs = null;
  try {
    prefs = await UserPreferences.findOne({ userId }).select('presets').lean();
  } catch (e) {
    logger.warn('[editor-presets] read failed', { error: e.message });
  }
  const presets = (prefs?.presets || []).filter((p) => p && p.category === CATEGORY).map(shape);
  return sendSuccess(res, { presets });
}));

// POST — save the current look
router.post('/presets', auth, asyncHandler(async (req, res) => {
  const userId = uid(req);
  if (!userId) return sendError(res, 'Authentication required', 401);
  if (isDevUser(userId)) return sendError(res, 'Saving looks is unavailable for the demo user', 403);

  const name = (typeof req.body.name === 'string' && req.body.name.trim()) ? req.body.name.trim().slice(0, 60) : 'My Look';
  const settings = sanitizeSettings(req.body.settings);
  if (!Object.keys(settings).length) return sendError(res, 'No valid look settings to save', 400);

  let prefs = await UserPreferences.findOne({ userId });
  if (!prefs) prefs = new UserPreferences({ userId });
  prefs.presets = Array.isArray(prefs.presets) ? prefs.presets : [];
  const looks = prefs.presets.filter((p) => p && p.category === CATEGORY);
  if (looks.length >= MAX_LOOKS) return sendError(res, `You can save up to ${MAX_LOOKS} looks`, 400);

  const preset = {
    id: `look-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: CATEGORY,
    settings,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
    isPublic: false,
  };
  prefs.presets.push(preset);
  prefs.markModified('presets');
  await prefs.save();
  return sendSuccess(res, { preset: shape(preset) });
}));

// DELETE — remove a saved look (scoped to the caller)
router.delete('/presets/:id', auth, asyncHandler(async (req, res) => {
  const userId = uid(req);
  if (!userId) return sendError(res, 'Authentication required', 401);
  const id = String(req.params.id || '');
  const prefs = await UserPreferences.findOne({ userId });
  if (!prefs || !Array.isArray(prefs.presets)) return sendSuccess(res, { removed: 0 });
  const before = prefs.presets.length;
  prefs.presets = prefs.presets.filter((p) => !(p && p.category === CATEGORY && p.id === id));
  prefs.markModified('presets');
  await prefs.save();
  return sendSuccess(res, { removed: before - prefs.presets.length });
}));

module.exports = router;
