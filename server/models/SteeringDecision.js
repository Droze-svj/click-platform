// Steering Decision Model
// Persists a real record each time a user steers their monetization funnel
// toward a specific offer (Phase 11: Arbitrage Steering). No mock data — every
// row is an actual user action.

const mongoose = require('mongoose');

const steeringDecisionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  offerId: {
    type: String,
    required: true
  },
  offerName: {
    type: String,
    default: ''
  },
  targetNiche: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

steeringDecisionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SteeringDecision', steeringDecisionSchema);
