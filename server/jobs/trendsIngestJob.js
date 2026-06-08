/**
 * trends-ingest job — pulls trending sounds/hashtags/topics from
 * liveTrendService for each platform and persists a snapshot. Designed to
 * run every 15 minutes via BullMQ repeatable jobs.
 *
 * Robustness notes:
 *   - liveTrendService is wrapped so a single dead provider (TikTok endpoint
 *     down, etc.) doesn't take the whole job down.
 *   - Velocity is computed against the previous snapshot for the same
 *     (platform, region); on first run it's 0.
 *   - TrendSnapshot has a 24h TTL — historical analytics live elsewhere.
 */

const logger = require('../utils/logger');
const liveTrendService = require('../services/liveTrendService');
const TrendSnapshot = require('../models/TrendSnapshot');

// Optional Sentry — mirror utils/googleAI.js so a missing @sentry/node never
// crashes the job.
let Sentry = null;
try {
  Sentry = require('@sentry/node');
} catch (_) {
  // Optional dependency in some local environments
}

const PLATFORMS = ['tiktok', 'instagram', 'youtube'];
const DEFAULT_REGION = 'us';

// Read-only observability snapshot of the last run for GET /api/health/learning.
let lastRunStats = null;

function normalizeItems(raw, kindHint) {
  if (!raw) return [];
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.items)
      ? raw.items
      : Array.isArray(raw.sounds)
        ? raw.sounds.map((s) => ({ ...s, _kind: 'sound' }))
        : Array.isArray(raw.hashtags)
          ? raw.hashtags.map((h) => ({ ...h, _kind: 'hashtag' }))
          : Array.isArray(raw.topics)
            ? raw.topics.map((t) => ({ ...t, _kind: 'topic' }))
            : [];
  return arr
    .filter(Boolean)
    .map((it, i) => {
      const kind = it._kind || it.kind || kindHint || 'topic';
      const label = it.label || it.name || it.title || it.text || it.tag || it.id;
      if (!label) return null;
      return {
        kind,
        label: String(label).slice(0, 200),
        externalId: it.id || it.externalId || it.soundId || null,
        score: typeof it.score === 'number' ? it.score : Math.max(0, 100 - i),
        velocity: typeof it.velocity === 'number' ? it.velocity : 0,
        metadata: it.metadata || null,
      };
    })
    .filter(Boolean);
}

async function fetchPlatform(platform) {
  try {
    const r = await liveTrendService.getLatestTrends(platform);
    if (!r) return [];
    return [...normalizeItems(r.sounds, 'sound'), ...normalizeItems(r.hashtags, 'hashtag'), ...normalizeItems(r.topics, 'topic')];
  } catch (err) {
    logger.warn('[trends-ingest] platform fetch failed', { platform, error: err.message });
    return [];
  }
}

async function applyVelocity(platform, region, items) {
  try {
    const prev = await TrendSnapshot.findOne(
      { platform, region },
      { items: 1 },
      { sort: { capturedAt: -1 } }
    ).lean();
    if (!prev || !Array.isArray(prev.items)) return items;
    const prevRankByLabel = new Map();
    prev.items.forEach((p, idx) => prevRankByLabel.set(p.label, idx));
    return items.map((it, idx) => {
      const prevIdx = prevRankByLabel.get(it.label);
      if (typeof prevIdx !== 'number') {
        return { ...it, velocity: 100 }; // brand-new entry
      }
      return { ...it, velocity: prevIdx - idx };
    });
  } catch {
    return items;
  }
}

async function ingestOnce({ region = DEFAULT_REGION } = {}) {
  const startedAt = Date.now();
  const summary = [];
  try {
    for (const platform of PLATFORMS) {
      const raw = await fetchPlatform(platform);
      const items = await applyVelocity(platform, region, raw);
      if (items.length === 0) {
        summary.push({ platform, count: 0, skipped: 'no items' });
        continue;
      }
      try {
        await TrendSnapshot.create({ platform, region, items });
        summary.push({ platform, count: items.length });
      } catch (err) {
        logger.warn('[trends-ingest] persist failed', { platform, error: err.message });
        summary.push({ platform, count: items.length, error: err.message });
      }
    }
    const trendsIngested = summary.reduce((acc, s) => acc + (s.count || 0), 0);
    const durationMs = Date.now() - startedAt;
    // Structured per-run summary requested for prod observability.
    try {
      logger.info('[trends-ingest] cycle complete', {
        platforms: PLATFORMS,
        trendsIngested,
        source: 'liveTrendService',
        region,
        durationMs,
        summary,
      });
    } catch { /* logger optional */ }
    lastRunStats = {
      at: new Date().toISOString(),
      ok: true,
      platforms: PLATFORMS,
      trendsIngested,
      source: 'liveTrendService',
      region,
      durationMs,
    };
    return summary;
  } catch (err) {
    lastRunStats = {
      at: new Date().toISOString(),
      ok: false,
      error: err && err.message,
      platforms: PLATFORMS,
      source: 'liveTrendService',
      region,
      durationMs: Date.now() - startedAt,
    };
    if (Sentry && typeof Sentry.captureException === 'function') {
      try { Sentry.captureException(err); } catch (_) { /* sentry optional */ }
    }
    throw err;
  }
}

/**
 * Read-only snapshot of the last trends-ingest run for the health surface.
 */
function getLastRunStats() {
  return lastRunStats;
}

/**
 * Process a single BullMQ job invocation.
 */
async function processTrendsIngestJob(job) {
  return ingestOnce(job?.data || {});
}

/**
 * Register the repeatable BullMQ schedule. Idempotent — safe to call from
 * server boot. If BullMQ isn't wired we just log and exit.
 */
async function registerTrendsIngestSchedule() {
  try {
    const { getQueue } = require('../services/jobQueueService');
    const queue = getQueue('trends-ingest');
    if (!queue || !queue.add) {
      logger.warn('[trends-ingest] queue unavailable; schedule not registered');
      return null;
    }
    await queue.add(
      'trends-ingest:cycle',
      {},
      {
        repeat: { every: 15 * 60 * 1000 },
        jobId: 'trends-ingest:cycle',
        removeOnComplete: 100,
        removeOnFail: 100,
      }
    );
    logger.info('[trends-ingest] schedule registered (every 15m)');
    return queue;
  } catch (err) {
    logger.warn('[trends-ingest] failed to register schedule', { error: err.message });
    return null;
  }
}

module.exports = {
  ingestOnce,
  processTrendsIngestJob,
  registerTrendsIngestSchedule,
  getLastRunStats,
};
