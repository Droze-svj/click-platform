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

/**
 * Performance-weighted counter: tracks not just *that* the user picked a
 * value but *how well it performed* once published. `performanceScore` is a
 * weighted-average retention delta in [-1, 1]; `sampleSize` lets the editor
 * weight by confidence ("this score is solid" vs "we've only seen it twice").
 */
const weightedCounterSchema = new mongoose.Schema({
  key: { type: String, required: true },
  count: { type: Number, default: 0 },
  lastUsedAt: { type: Date, default: Date.now },
  performanceScore: { type: Number, default: 0 },
  sampleSize: { type: Number, default: 0 },
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

  // Performance-weighted versions of the same facets — populated by
  // creatorPerformanceService once a published post's analytics arrive.
  // The plain counters above keep tracking taste; these track taste *that
  // performed*, so the editor can rank suggestions by retention impact.
  weightedFonts:        { type: [weightedCounterSchema], default: [] },
  weightedCaptionStyles:{ type: [weightedCounterSchema], default: [] },
  weightedAnimations:   { type: [weightedCounterSchema], default: [] },
  weightedMotions:      { type: [weightedCounterSchema], default: [] },
  weightedColorGrades:  { type: [weightedCounterSchema], default: [] },
  weightedTransitions:  { type: [weightedCounterSchema], default: [] },
  weightedHooks:        { type: [weightedCounterSchema], default: [] },

  // Numeric averages — useful for things like "this user prefers cuts every
  // 1.6s on average" or "edits at ~32px font size".
  averages: {
    avgCutDuration:    { type: Number, default: null },  // seconds
    avgFontSize:       { type: Number, default: null },  // px
    avgCaptionLength:  { type: Number, default: null },  // characters
    avgVideoDuration:  { type: Number, default: null },  // seconds
  },

  totalPicks: { type: Number, default: 0 },
  lastIngestedAt: { type: Date, default: null },
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
 * recordPerformance — update a weighted counter when a published post's
 * engagement comes back from analytics. `retentionDelta` is in [-1, 1]; the
 * weighted-average formula gives newer data 0.3 weight against the historical
 * 0.7. `sampleSize` tracks confidence so the UI can label "limited data".
 */
userStyleProfileSchema.statics.recordPerformance = async function recordPerformance(
  userId, weightedFacet, key, retentionDelta,
) {
  if (!userId || !weightedFacet || !key || typeof retentionDelta !== 'number') return null;
  const allowed = [
    'weightedFonts', 'weightedCaptionStyles', 'weightedAnimations', 'weightedMotions',
    'weightedColorGrades', 'weightedTransitions', 'weightedHooks',
  ];
  if (!allowed.includes(weightedFacet)) throw new Error(`Invalid weighted facet: ${weightedFacet}`);

  const profile = await this.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const arr = profile[weightedFacet] || [];
  const existing = arr.find(c => c.key === key);
  if (existing) {
    const prev = existing.performanceScore || 0;
    existing.performanceScore = prev * 0.7 + retentionDelta * 0.3;
    existing.sampleSize = (existing.sampleSize || 0) + 1;
    existing.lastUsedAt = new Date();
    existing.count = (existing.count || 0) + 1;
  } else {
    arr.push({ key, count: 1, performanceScore: retentionDelta, sampleSize: 1, lastUsedAt: new Date() });
    profile[weightedFacet] = arr;
  }
  profile.lastIngestedAt = new Date();
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

/**
 * topPerformers — returns weighted counters ordered by performanceScore × log(sampleSize+1).
 * The log-scaling avoids over-weighting picks with sample size 1.
 */
userStyleProfileSchema.methods.topPerformers = function topPerformers(weightedFacet, limit = 5) {
  const arr = this[weightedFacet] || [];
  return arr
    .slice()
    .sort((a, b) => {
      const aScore = (a.performanceScore || 0) * Math.log((a.sampleSize || 0) + 1);
      const bScore = (b.performanceScore || 0) * Math.log((b.sampleSize || 0) + 1);
      return bScore - aScore;
    })
    .slice(0, limit)
    .map(c => ({
      key: c.key,
      count: c.count,
      performanceScore: c.performanceScore || 0,
      sampleSize: c.sampleSize || 0,
      lastUsedAt: c.lastUsedAt,
    }));
};

module.exports = mongoose.models.UserStyleProfile
  || mongoose.model('UserStyleProfile', userStyleProfileSchema);
