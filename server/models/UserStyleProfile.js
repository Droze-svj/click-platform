/**
 * UserStyleProfile — Click's per-creator taste graph.
 *
 * Records what each user actually picks while editing (fonts, caption styles,
 * motion presets, animations, color grades, transitions, niches, platforms).
 * The editor reads this on load and biases suggestion ordering so creators
 * see options that match their established style first, while still being
 * able to discover new ones.
 *
 * Designed for additive writes: every pick increments a counter rather than
 * overwriting state. This keeps the profile stable across small experiments
 * and lets us compute confidence as `count / totalPicks`.
 */

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  key: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
}, { _id: false });

const userStyleProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },

  // Aggregate counts per facet. Each facet stores an array of counters keyed
  // by the picked value (e.g. fonts: [{key: 'Inter', count: 14, lastUsedAt}]).
  fonts:        { type: [counterSchema], default: [] },
  captionStyles:{ type: [counterSchema], default: [] },
  animations:   { type: [counterSchema], default: [] },
  motions:      { type: [counterSchema], default: [] },
  colorGrades:  { type: [counterSchema], default: [] },
  transitions:  { type: [counterSchema], default: [] },
  niches:       { type: [counterSchema], default: [] },
  platforms:    { type: [counterSchema], default: [] },

  // Numeric averages — useful for things like "this user prefers cuts every
  // 1.6s on average" or "edits at ~32px font size".
  averages: {
    avgCutDuration:    { type: Number, default: null },  // seconds
    avgFontSize:       { type: Number, default: null },  // px
    avgCaptionLength:  { type: Number, default: null },  // characters
    avgVideoDuration:  { type: Number, default: null },  // seconds
  },

  totalPicks: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// ── Static helpers ────────────────────────────────────────────────────────

/**
 * Increment a single counter on a facet. Creates the counter if missing.
 */
userStyleProfileSchema.statics.recordPick = async function recordPick(userId, facet, key) {
  if (!userId || !facet || !key) return null;
  const validFacets = ['fonts', 'captionStyles', 'animations', 'motions', 'colorGrades', 'transitions', 'niches', 'platforms'];
  if (!validFacets.includes(facet)) throw new Error(`Invalid facet: ${facet}`);

  // Try to bump an existing counter
  const bumped = await this.findOneAndUpdate(
    { userId, [`${facet}.key`]: key },
    {
      $inc: { [`${facet}.$.count`]: 1, totalPicks: 1 },
      $set: { [`${facet}.$.lastUsedAt`]: new Date() },
    },
    { new: true }
  );
  if (bumped) return bumped;

  // Otherwise upsert and append
  return this.findOneAndUpdate(
    { userId },
    {
      $push: { [facet]: { key, count: 1, lastUsedAt: new Date() } },
      $inc: { totalPicks: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

/**
 * Update a running average. Uses a simple weighted update so newer picks have
 * a slightly higher weight than the cumulative history.
 */
userStyleProfileSchema.statics.recordAverage = async function recordAverage(userId, key, value) {
  if (!userId || typeof value !== 'number' || !isFinite(value)) return null;
  const allowed = ['avgCutDuration', 'avgFontSize', 'avgCaptionLength', 'avgVideoDuration'];
  if (!allowed.includes(key)) return null;

  const profile = await this.findOne({ userId });
  if (!profile) {
    return this.create({ userId, averages: { [key]: value } });
  }
  const current = profile.averages?.[key];
  const next = current == null ? value : current * 0.7 + value * 0.3;
  profile.averages = { ...profile.averages, [key]: next };
  await profile.save();
  return profile;
};

/**
 * Returns counters sorted by frequency (desc) for biasing UI tile order.
 */
userStyleProfileSchema.methods.topPicks = function topPicks(facet, limit = 8) {
  const arr = this[facet] || [];
  return arr
    .slice()
    .sort((a, b) => (b.count - a.count) || ((b.lastUsedAt?.getTime?.() || 0) - (a.lastUsedAt?.getTime?.() || 0)))
    .slice(0, limit)
    .map(c => ({ key: c.key, count: c.count, lastUsedAt: c.lastUsedAt }));
};

module.exports = mongoose.models.UserStyleProfile
  || mongoose.model('UserStyleProfile', userStyleProfileSchema);
