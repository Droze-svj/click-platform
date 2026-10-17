// Morning Brief delivery preference — opt-in, one per user.
// The brief cron (every 15 min) sends within `hour` local time in `timezone`
// over the chosen channels, and records the local date it last sent so a
// restart never double-sends.

const mongoose = require('mongoose');

const briefSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true, index: true },
  timezone: { type: String, required: true }, // IANA, e.g. "Europe/Rome"
  hour: { type: Number, default: 7, min: 0, max: 23 },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
  },
  lastSentLocalDate: { type: String, default: null }, // 'YYYY-MM-DD' in `timezone`
}, { timestamps: true });

module.exports = mongoose.model('BriefSubscription', briefSubscriptionSchema);
