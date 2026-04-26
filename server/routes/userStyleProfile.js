/**
 * /api/style-profile — read & write Click's per-user taste graph.
 *
 * Endpoints
 *   GET  /api/style-profile           Return current user's profile (created on first read).
 *   POST /api/style-profile/pick      Body: { facet, key } — increment a counter.
 *   POST /api/style-profile/average   Body: { key, value } — update a running average.
 *   POST /api/style-profile/batch     Body: { picks: [{facet,key}], averages: [{key,value}] }
 */

const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const UserStyleProfile = require('../models/UserStyleProfile');
const { isDevUser } = require('../utils/devUser');

const router = express.Router();

// Dev-mode in-memory profile so the editor can record picks without Mongo.
const devProfiles = new Map();

function getDevProfile(userId) {
  let p = devProfiles.get(userId);
  if (!p) {
    p = {
      userId,
      fonts: [], captionStyles: [], animations: [], motions: [],
      colorGrades: [], transitions: [], niches: [], platforms: [],
      averages: { avgCutDuration: null, avgFontSize: null, avgCaptionLength: null, avgVideoDuration: null },
      totalPicks: 0,
    };
    devProfiles.set(userId, p);
  }
  return p;
}

function devRecordPick(userId, facet, key) {
  const p = getDevProfile(userId);
  if (!p[facet]) return null;
  let counter = p[facet].find(c => c.key === key);
  if (counter) {
    counter.count += 1;
    counter.lastUsedAt = new Date().toISOString();
  } else {
    p[facet].push({ key, count: 1, lastUsedAt: new Date().toISOString() });
  }
  p.totalPicks += 1;
  return p;
}

function devRecordAverage(userId, key, value) {
  const p = getDevProfile(userId);
  if (!(key in p.averages)) return null;
  const current = p.averages[key];
  p.averages[key] = current == null ? value : current * 0.7 + value * 0.3;
  return p;
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user)) {
      return res.json({ success: true, data: getDevProfile(String(userId)) });
    }

    let profile = await UserStyleProfile.findOne({ userId });
    if (!profile) profile = await UserStyleProfile.create({ userId });
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] GET failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/pick', auth, async (req, res) => {
  try {
    const { facet, key } = req.body || {};
    if (!facet || !key) return res.status(400).json({ success: false, error: 'facet and key are required' });

    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user)) {
      const profile = devRecordPick(String(userId), facet, key);
      return res.json({ success: true, data: profile });
    }

    const profile = await UserStyleProfile.recordPick(userId, facet, key);
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] pick failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/average', auth, async (req, res) => {
  try {
    const { key, value } = req.body || {};
    if (!key || typeof value !== 'number') {
      return res.status(400).json({ success: false, error: 'key and numeric value are required' });
    }
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });

    if (isDevUser(req.user)) {
      const profile = devRecordAverage(String(userId), key, value);
      return res.json({ success: true, data: profile });
    }

    const profile = await UserStyleProfile.recordAverage(userId, key, value);
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] average failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batch', auth, async (req, res) => {
  try {
    const { picks = [], averages = [] } = req.body || {};
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthenticated' });
    const dev = isDevUser(req.user);

    let profile = null;
    for (const p of picks) {
      if (!p?.facet || !p?.key) continue;
      profile = dev
        ? devRecordPick(String(userId), p.facet, p.key)
        : await UserStyleProfile.recordPick(userId, p.facet, p.key);
    }
    for (const a of averages) {
      if (!a?.key || typeof a?.value !== 'number') continue;
      profile = dev
        ? devRecordAverage(String(userId), a.key, a.value)
        : await UserStyleProfile.recordAverage(userId, a.key, a.value);
    }
    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('[style-profile] batch failed', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
