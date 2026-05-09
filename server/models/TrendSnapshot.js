const mongoose = require('mongoose');

/**
 * Periodic snapshot of trending sounds, hashtags, and topics per platform.
 * Written by the trends-ingest BullMQ job (every 15 min) so the editor's
 * "Trending now" rail can read fresh state without hitting platform APIs on
 * every dashboard load.
 *
 * Indexed by platform + capturedAt; old snapshots are reaped via TTL on
 * `expiresAt` so the collection stays small.
 */
const trendItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['sound', 'hashtag', 'topic'], required: true },
    label: { type: String, required: true },
    /** Provider-native identifier (TikTok soundId, IG hashtag id, etc.) */
    externalId: String,
    score: { type: Number, default: 0 },
    /** Heuristic velocity: rank-change vs the previous snapshot. */
    velocity: { type: Number, default: 0 },
    metadata: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const trendSnapshotSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['tiktok', 'instagram', 'youtube', 'x', 'all'],
      required: true,
      index: true,
    },
    region: { type: String, default: 'us' },
    capturedAt: { type: Date, default: Date.now, index: true },
    /** TTL anchor — Mongo auto-deletes snapshots older than 24 h. */
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
    items: { type: [trendItemSchema], default: [] },
    source: { type: String, default: 'liveTrendService' },
  },
  { timestamps: true }
);

trendSnapshotSchema.index({ platform: 1, capturedAt: -1 });

module.exports = mongoose.models.TrendSnapshot || mongoose.model('TrendSnapshot', trendSnapshotSchema);
