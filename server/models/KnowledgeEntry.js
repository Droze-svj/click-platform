// Knowledge Entry Model
// Persists real S2S knowledge-ledger tactics (Phase 12). Each entry is created
// by an actual broadcast pulse and updated by real subsequent pulses — replaces
// the previous in-memory hardcoded ledger. No fabricated/random values.

const mongoose = require('mongoose');

const knowledgeEntrySchema = new mongoose.Schema({
  // Scope a tactic to a user; null = global/shared tactic.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  tactic: {
    type: String,
    required: true,
    trim: true
  },
  viralScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  // Number of real pulses that have reinforced this tactic.
  pulseCount: {
    type: Number,
    default: 0
  },
  lastSource: {
    type: String,
    default: 'local'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

knowledgeEntrySchema.index({ userId: 1, tactic: 1 }, { unique: true });

knowledgeEntrySchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('KnowledgeEntry', knowledgeEntrySchema);
