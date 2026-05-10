/**
 * clipRetentionService — 14-day retention for AI-generated clips.
 *
 * Scope: only entries inside `Content.generatedContent.shortVideos[]` that
 * came from the AI auto-edit pipeline (marked with `aiGenerated: true` or
 * `source: 'ai-auto-edit'`). The user's original uploads and manual edits
 * are NOT touched.
 *
 * Strategy: soft-delete by setting `expiredAt` + `expired: true` on the clip
 * entry. The hub UI filters out expired clips. A second pass (run weekly)
 * permanently removes clips that have been expired for >7 days, freeing
 * storage. This gives a recovery window if a user complains.
 *
 * Idempotent — safe to run hourly or daily.
 */

const Content = require('../models/Content');
const logger = require('../utils/logger');

const RETENTION_DAYS = 14;
const HARD_DELETE_GRACE_DAYS = 7;

function expiryThreshold(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Mark AI-generated clips older than RETENTION_DAYS as expired.
 * Returns { scanned, expired }.
 */
async function softExpireOldClips() {
  const cutoff = expiryThreshold(RETENTION_DAYS);

  // Pull a lean projection of every Content doc that has shortVideos. This
  // is cheaper than mutating with $set + arrayFilters because we need to
  // examine `aiGenerated` per element.
  const docs = await Content.find({
    'generatedContent.shortVideos.0': { $exists: true },
  }).select('_id generatedContent.shortVideos').lean(false);

  let scanned = 0;
  let expired = 0;

  for (const doc of docs) {
    let mutated = false;
    const list = doc.generatedContent?.shortVideos || [];
    for (const clip of list) {
      scanned += 1;
      if (clip.expired) continue;
      const isAi = clip.aiGenerated === true || clip.source === 'ai-auto-edit';
      if (!isAi) continue;
      const created = clip.createdAt || clip.generatedAt || clip.timestamp;
      if (!created) continue;
      if (new Date(created) > cutoff) continue;
      clip.expired = true;
      clip.expiredAt = new Date();
      expired += 1;
      mutated = true;
    }
    if (mutated) {
      doc.markModified('generatedContent');
      try {
        await doc.save();
      } catch (e) {
        logger.warn('clipRetention: save failed', { contentId: String(doc._id), error: e.message });
      }
    }
  }

  if (expired > 0) {
    logger.info('clipRetention: soft-expired clips', { scanned, expired });
  }
  return { scanned, expired };
}

/**
 * Permanently remove clips that have been soft-expired for at least
 * HARD_DELETE_GRACE_DAYS. Returns { scanned, hardDeleted }.
 */
async function hardDeleteExpiredClips() {
  const cutoff = expiryThreshold(HARD_DELETE_GRACE_DAYS);

  const docs = await Content.find({
    'generatedContent.shortVideos.expired': true,
  }).select('_id generatedContent.shortVideos').lean(false);

  let scanned = 0;
  let hardDeleted = 0;

  for (const doc of docs) {
    const before = doc.generatedContent?.shortVideos?.length || 0;
    if (!before) continue;
    const filtered = (doc.generatedContent.shortVideos || []).filter(clip => {
      scanned += 1;
      if (!clip.expired) return true;
      if (!clip.expiredAt) return true; // never marked, keep
      if (new Date(clip.expiredAt) > cutoff) return true; // still in grace
      hardDeleted += 1;
      return false;
    });
    if (filtered.length !== before) {
      doc.generatedContent.shortVideos = filtered;
      doc.markModified('generatedContent');
      try {
        await doc.save();
      } catch (e) {
        logger.warn('clipRetention: hard-delete save failed', { contentId: String(doc._id), error: e.message });
      }
    }
  }

  if (hardDeleted > 0) {
    logger.info('clipRetention: hard-deleted expired clips', { scanned, hardDeleted });
  }
  return { scanned, hardDeleted };
}

module.exports = {
  RETENTION_DAYS,
  HARD_DELETE_GRACE_DAYS,
  softExpireOldClips,
  hardDeleteExpiredClips,
};
