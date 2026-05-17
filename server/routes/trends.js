/**
 * GET /api/trends/now — latest trending sounds/hashtags/topics for a platform.
 * Reads from the TrendSnapshot collection populated by the trends-ingest
 * BullMQ job (every 15 min). Falls through to a live call if no snapshot
 * exists yet.
 */

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const TrendSnapshot = require('../models/TrendSnapshot');
const liveTrendService = require('../services/liveTrendService');

const router = express.Router();

router.get(
  '/now',
  auth,
  asyncHandler(async (req, res) => {
    const platform = String(req.query.platform || 'tiktok').toLowerCase();
    const region = String(req.query.region || 'us').toLowerCase();
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const kindFilter = req.query.kind ? String(req.query.kind) : null;

    const snap = await TrendSnapshot.findOne(
      { platform, region },
      { items: 1, capturedAt: 1 },
      { sort: { capturedAt: -1 } }
    ).lean();

    if (snap?.items?.length) {
      const items = (kindFilter ? snap.items.filter((i) => i.kind === kindFilter) : snap.items).slice(0, limit);
      return sendSuccess(res, {
        platform,
        region,
        capturedAt: snap.capturedAt,
        items,
        source: 'snapshot',
      });
    }

    // Live fallback (slow path) — only hits provider when no snapshot exists.
    let live = [];
    try {
      const r = await liveTrendService.getLatestTrends(platform);
      live = []
        .concat((r?.sounds || []).map((s, i) => ({ kind: 'sound', label: s.label || s.name, score: 100 - i })))
        .concat((r?.hashtags || []).map((h, i) => ({ kind: 'hashtag', label: h.label || h.tag, score: 100 - i })))
        .concat((r?.topics || []).map((t, i) => ({ kind: 'topic', label: t.label || t.title, score: 100 - i })));
    } catch {
      live = [];
    }
    return sendSuccess(res, {
      platform,
      region,
      capturedAt: null,
      items: (kindFilter ? live.filter((i) => i.kind === kindFilter) : live).slice(0, limit),
      source: 'live',
    });
  })
);

module.exports = router;
