/**
 * WebhookEvent — idempotency record for inbound webhooks.
 *
 * Whop (and most webhook providers) retries on any non-2xx response and
 * occasionally double-fires on flaky networks. Without an idempotency
 * check, a replayed payment.succeeded would re-apply the upgrade — fine
 * once, but on a cancelled→succeeded race it can flip a churned user
 * back to active. This collection records every event we've successfully
 * processed so retries become safe no-ops.
 *
 * Compound unique index on (provider, eventId) lets us look up
 * "have we seen this exact event" in O(log n) and prevents two
 * concurrent webhook workers from both processing the same event.
 */

const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['whop', 'stripe', 'unknown'],
      index: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: { type: String },
    receivedAt: { type: Date, default: Date.now },
    // false = claimed but processing didn't finish (a crash/transient error).
    // A retry of an UNPROCESSED event is allowed to re-run, so a failure between
    // claim and apply can't permanently drop a paid entitlement. Set true only
    // after processEvent succeeds → true duplicates then skip.
    processed: { type: Boolean, default: false },
    result: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

// TTL: keep records for 90 days. Plenty for replay detection windows;
// long enough that a forensic look-back stays useful.
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);
