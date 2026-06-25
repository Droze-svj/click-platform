// SocialVideo — the canonical record of a creator's video ON A PLATFORM, whether
// it was published through Click OR already lived on their connected channel
// (imported via the platform API). This unifies the Growth/SEO layer so outliers,
// retention, and audits cover a creator's ENTIRE channel, not just Click posts.
//
// Keyed by (userId, platform, externalId). `contentId` links back to a Click
// Content doc when the video was published through Click; null for imported ones.

const mongoose = require('mongoose');

const socialVideoSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  accountId: { type: String, default: null }, // which connected account (multi-account)
  platform: { type: String, required: true, default: 'youtube' },
  externalId: { type: String, required: true }, // e.g. the YouTube videoId

  // Link to a Click Content doc when this video originated in Click.
  contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', default: null, index: true },

  title: { type: String, default: '' },
  thumbnail: { type: String, default: null },
  hasThumbnail: { type: Boolean, default: false },
  durationSec: { type: Number, default: 0 },
  publishedAt: { type: Date, default: null },

  // Latest snapshot of public metrics (refreshed on each sync).
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },

  source: { type: String, enum: ['click', 'import'], default: 'import' },
  lastSyncedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One row per (user, platform, video). Upserts key on this.
socialVideoSchema.index({ userId: 1, platform: 1, externalId: 1 }, { unique: true });
// Ranking / scoping for outliers.
socialVideoSchema.index({ userId: 1, platform: 1, accountId: 1, views: -1 });

module.exports = mongoose.model('SocialVideo', socialVideoSchema);
