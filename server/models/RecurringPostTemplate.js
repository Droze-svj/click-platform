// Recurring post template — represents a "post the same kind of thing on
// a cadence" rule. Distinct from ScheduledPost (one-shot publish at a
// fixed time). The recurring-post cron reads these every 5 minutes and
// spawns a ScheduledPost when the next-fire time has elapsed.
//
// Cadence model: simple interval-based rather than full cron, because
// creators think in human terms ("3x per week, Mon/Wed/Fri at 9 AM")
// not "0 9 * * 1,3,5". We store the human form so the UI can render
// it without parsing back.

const mongoose = require('mongoose');

const recurringPostTemplateSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },

  // Which platform + connected account the spawned posts target. The
  // worker still does its own pre-flight check at publish-time, but the
  // template stores the user's preference so swapping accounts doesn't
  // require re-creating every template.
  platform: {
    type: String,
    required: true,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads'],
  },
  accountId: { type: String, default: null },

  // Content the spawned post will use. Each fire can either re-use the
  // exact same content (campaign-style) or rotate through a content
  // pool — `contentPool` wins if non-empty, else `content` is used.
  content: {
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    hashtags: [{ type: String }],
  },
  contentPool: [{
    text: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    hashtags: [{ type: String }],
  }],
  // Tracks where we are in the pool rotation so each fire uses the
  // next item (round-robin). Reset to 0 when contentPool changes.
  poolCursor: { type: Number, default: 0 },

  // Cadence — human form: e.g. "weekly, Mon/Wed/Fri at 09:00 UTC"
  // Machine form: the days-of-week (0=Sun) + the time-of-day (HH:MM) +
  // the user's timezone. The cron evaluates these directly.
  cadence: {
    daysOfWeek: { type: [Number], default: [] }, // 0..6, Sunday=0
    timeOfDay: { type: String, default: '09:00' }, // HH:MM 24h
    timezone: { type: String, default: 'UTC' },
    // Stop the recurrence after N total fires, or after a specific date.
    // Both null means "run forever until the user pauses".
    maxFires: { type: Number, default: null },
    endsAt: { type: Date, default: null },
  },

  active: { type: Boolean, default: true, index: true },

  // Cron bookkeeping
  fireCount: { type: Number, default: 0 },
  lastFiredAt: { type: Date, default: null },
  nextFireAt: { type: Date, default: null, index: true },
}, {
  timestamps: true,
});

// Compound index: most cron queries are "active templates whose next
// fire-time has elapsed", so this is the one we want hot in memory.
recurringPostTemplateSchema.index({ active: 1, nextFireAt: 1 });

module.exports = mongoose.model('RecurringPostTemplate', recurringPostTemplateSchema);
