// Organized music browse — GET /api/music/browse
//
// Returns the tracks a creator can use (their OWN + public catalog) plus the same
// tracks grouped by category (genre / mood / energy / usage) for an organized picker.
// Per-user isolated; honest empty groups when there are no tracks. Read-only, no
// outbound calls — safe for the smoke sweep to exercise.

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const Music = require('../models/Music');
const { signMediaUrls } = require('../utils/mediaUrlSigner');
const { isDevUser } = require('../utils/devUser');
const logger = require('../utils/logger');

const router = express.Router();

const EMPTY = { tracks: [], byGenre: {}, byMood: {}, byEnergy: {}, byUsage: {} };

router.get('/browse', auth, asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id;
  if (!userId) return sendSuccess(res, EMPTY);

  const limit = Math.max(1, Math.min(200, parseInt(Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit, 10) || 100));
  // Dev/mock user → public catalog only (their id is a non-ObjectId string).
  const query = isDevUser(userId) ? { isPublic: true } : { $or: [{ userId }, { isPublic: true }] };
  for (const f of ['genre', 'mood', 'energy', 'vocals']) {
    if (typeof req.query[f] === 'string' && req.query[f].trim()) query[f] = req.query[f].trim();
  }
  if (typeof req.query.search === 'string' && req.query.search.trim()) {
    const rx = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [{ $or: [{ title: rx }, { artist: rx }, { tags: { $in: [rx] } }] }];
  }

  let docs = [];
  try {
    docs = await Music.find(query).sort({ createdAt: -1 }).limit(limit);
  } catch (e) {
    logger.warn('[music-browse] query failed', { error: e.message });
    return sendSuccess(res, EMPTY);
  }

  const tracks = signMediaUrls(docs || []);
  const group = (key, multi) => {
    const out = {};
    for (const t of tracks) {
      const id = t._id != null ? String(t._id) : null;
      if (!id) continue;
      const vals = multi ? (Array.isArray(t[key]) ? t[key] : []) : [t[key]];
      for (const v of vals) {
        if (!v) continue;
        (out[v] = out[v] || []).push(id);
      }
    }
    return out;
  };

  return sendSuccess(res, {
    tracks,
    byGenre: group('genre', false),
    byMood: group('mood', false),
    byEnergy: group('energy', false),
    byUsage: group('usageContext', true),
  });
}));

module.exports = router;
