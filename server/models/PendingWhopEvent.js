const mongoose = require('mongoose');

// A verified Whop webhook event that matched no Click account — usually a
// purchase made on Whop with an email that has no account yet (or before the
// buyer signed up). It used to be dropped ("user-not-found"), so the payment
// never granted a plan. It's replayed when an account with that email (or
// Whop user id) registers or signs in. See whopWebhookService.claimPendingEvents.
const pendingWhopEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: String,
  email: { type: String, lowercase: true, trim: true, index: true },
  whopUserId: { type: String, index: true },
  eventTime: Date,
  event: { type: mongoose.Schema.Types.Mixed, required: true },
  claimedAt: Date,
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  result: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.models.PendingWhopEvent || mongoose.model('PendingWhopEvent', pendingWhopEventSchema);
