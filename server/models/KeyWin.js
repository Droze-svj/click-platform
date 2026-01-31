// Key Win Model
// Track significant wins (PR, influencer interactions, etc.)

const mongoose = require('mongoose');

const keyWinSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost'
  },
  // Win Details
  win: {
    type: {
      type: String,
      enum: ['pr_mention', 'influencer_interaction', 'viral_post', 'media_coverage', 'award', 'partnership', 'milestone', 'other'],
      required: true,
      index: true
    },
    title: { type: String, required: true },
    description: String,
    date: { type: Date, required: true, index: true },
    impact: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
      index: true
    }
  },
  // Metrics
  metrics: {
    reach: { type: Number, default: 0 },
    engagement: { type: Number, default: 0 },
    mediaValue: { type: Number, default: 0 }, // Estimated PR value
    mentions: { type: Number, default: 0 },
    shares: { type: Number, default: 0 }
  },
  // Details
  details: {
    source: String, // Publication, influencer name, etc.
    url: String,
    screenshot: String,
    influencer: {
      name: String,
      handle: String,
      followers: Number,
      verified: Boolean
    },
    publication: {
      name: String,
      url: String,
      domainAuthority: Number
    }
  },
  // Attribution
  attribution: {
    content: String, // What content led to this win
    campaign: String,
    platform: String
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'archived'],
    default: 'confirmed',
    index: true
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

keyWinSchema.index({ clientWorkspaceId: 1, 'win.date': -1 });
keyWinSchema.index({ agencyWorkspaceId: 1, 'win.date': -1 });
keyWinSchema.index({ 'win.type': 1, 'win.date': -1 });
keyWinSchema.index({ 'win.impact': 1, 'win.date': -1 });

keyWinSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('KeyWin', keyWinSchema);


