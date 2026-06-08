/**
 * SuggestionHistory — anti-repetition log for AI suggestions.
 *
 * Every time the strategist or niche-intel endpoints emit a suggestion to a
 * user we record a stable hash here. The same endpoints check this collection
 * before returning new candidates and exclude any item the user has seen in
 * the last `windowSize` entries (default 50). When the filtered set is too
 * small to be useful we widen the window gracefully so the user never sees a
 * "no suggestions" empty state purely because of dedup pressure.
 *
 * Hash format: SHA-256 of a stable JSON-serialised candidate identifier
 * (e.g. `{ kind: 'hook-pattern', niche: 'finance', key: 'data-flex' }`).
 */

const mongoose = require('mongoose');

const suggestionHistorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  kind: { type: String, required: true, index: true },
  payloadHash: { type: String, required: true },
  // We keep the human-readable label for diagnostics; never trust it for dedup.
  label: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: false });

// Compound index for the hot read path: "what has this user seen recently?"
suggestionHistorySchema.index({ userId: 1, kind: 1, createdAt: -1 });

// TTL: anti-repetition only needs a recent window, so expire rows after 90 days
// to keep the collection bounded (it was previously unbounded). This single
// field index also serves any createdAt-only reads.
suggestionHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.models.SuggestionHistory
  || mongoose.model('SuggestionHistory', suggestionHistorySchema);
