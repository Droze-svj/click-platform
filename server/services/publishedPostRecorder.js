/**
 * Record a post published straight from the editor (YouTube upload, TikTok,
 * Instagram, Facebook) as a `posted` ScheduledPost.
 *
 * Only scheduled posts used to become ScheduledPost rows, and those rows are
 * what the analytics sync reads (views, likes, retention) and what the learning
 * loop learns from. Every video a creator published from the editor was
 * invisible to both: Click never saw how it did.
 *
 * Best-effort: never throws, so a recording problem can't fail a post that has
 * already gone out.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');
const ScheduledPost = require('../models/ScheduledPost');

const PLATFORMS = new Set(['tiktok', 'youtube', 'instagram', 'facebook', 'twitter', 'linkedin']);
const FAKE_ID = /^(mock-|ig_dry_|dry[-_]|post-\d+$)/i;

async function ownedContent(userId, contentId) {
  if (!contentId || !mongoose.isValidObjectId(String(contentId))) return null;
  try {
    const Content = require('../models/Content');
    const c = await Content.findById(String(contentId)).select('userId niche metadata.niche').lean();
    if (!c || String(c.userId) !== String(userId)) return null;
    return c;
  } catch (_) {
    return null;
  }
}

/**
 * @param {object} p
 * @param {string|ObjectId} p.userId
 * @param {string} p.platform
 * @param {{id?:string, platformPostId?:string, url?:string, publishId?:string}} p.result  the publisher's result
 * @param {string} [p.contentId]  the editor's video id (linked only if the caller owns it)
 * @param {string} [p.caption]
 * @returns {Promise<string|null>} the ScheduledPost id, or null when nothing was recorded
 */
async function recordDirectPost({ userId, platform, result, contentId = null, caption = '' } = {}) {
  try {
    const plat = String(platform || '').toLowerCase();
    const platformPostId = result && (result.platformPostId || result.id);
    if (!userId || !PLATFORMS.has(plat) || !platformPostId || FAKE_ID.test(String(platformPostId)) || result?.dryRun) {
      return null;
    }

    const content = await ownedContent(userId, contentId);
    const now = new Date();
    const filter = { userId: String(userId), platform: plat, platformPostId: String(platformPostId) };
    const doc = await ScheduledPost.findOneAndUpdate(
      filter,
      {
        $setOnInsert: {
          ...filter,
          status: 'posted',
          scheduledTime: now,
          postedAt: now,
          contentId: content ? String(content._id) : null,
          niche: content?.niche || content?.metadata?.niche || null,
          content: { text: String(caption || '').slice(0, 2200) },
          metadata: {
            source: 'direct',
            postUrl: result.url || null,
            ...(result.publishId ? { tiktokPublishId: String(result.publishId) } : {}),
          },
          // Nothing measured yet: mark as learned so the learning pass doesn't
          // count an empty result. The analytics sync stamps lastUpdated when
          // real numbers arrive, which queues it for learning.
          'analytics.lastUpdated': now,
          lastLearnedAt: now,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return doc ? String(doc._id) : null;
  } catch (err) {
    logger.warn('Could not record direct post for analytics', { platform, error: err.message });
    return null;
  }
}

module.exports = { recordDirectPost };
