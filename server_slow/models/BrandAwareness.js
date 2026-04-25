// Brand Awareness Model
// Track brand awareness indicators

const mongoose = require('mongoose');

const brandAwarenessSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  // Period
  period: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Profile Metrics
  profile: {
    visits: { type: Number, default: 0 },
    visitsGrowth: { type: Number, default: 0 }, // Percentage
    followers: { type: Number, default: 0 },
    followersGrowth: { type: Number, default: 0 }, // Percentage
    profileViews: { type: Number, default: 0 },
    profileViewsGrowth: { type: Number, default: 0 } // Percentage
  },
  // Reach Metrics
  reach: {
    total: { type: Number, default: 0 },
    growth: { type: Number, default: 0 }, // Percentage
    unique: { type: Number, default: 0 },
    organic: { type: Number, default: 0 },
    paid: { type: Number, default: 0 }
  },
  // Share of Voice
  shareOfVoice: {
    total: { type: Number, default: 0 }, // Percentage
    growth: { type: Number, default: 0 }, // Percentage change
    mentions: { type: Number, default: 0 },
    hashtagMentions: { type: Number, default: 0 },
    brandedMentions: { type: Number, default: 0 },
    competitorComparison: [{
      competitor: String,
      theirShare: Number,
      ourShare: Number,
      difference: Number
    }]
  },
  // Brand Mentions
  mentions: {
    total: { type: Number, default: 0 },
    positive: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    sentiment: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      default: 'neutral'
    }
  },
  // Awareness Score
  awarenessScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
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

brandAwarenessSchema.index({ workspaceId: 1, platform: 1, 'period.startDate': -1 });
brandAwarenessSchema.index({ clientWorkspaceId: 1, 'period.startDate': -1 });
brandAwarenessSchema.index({ agencyWorkspaceId: 1, 'period.startDate': -1 });

brandAwarenessSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate awareness score (weighted combination)
  let score = 0;

  // Profile visits growth (30%)
  if (this.profile.visitsGrowth > 0) {
    score += Math.min(30, (this.profile.visitsGrowth / 10) * 30);
  }

  // Reach growth (25%)
  if (this.reach.growth > 0) {
    score += Math.min(25, (this.reach.growth / 10) * 25);
  }

  // Share of voice (25%)
  if (this.shareOfVoice.total > 0) {
    score += Math.min(25, (this.shareOfVoice.total / 20) * 25);
  }

  // Followers growth (20%)
  if (this.profile.followersGrowth > 0) {
    score += Math.min(20, (this.profile.followersGrowth / 5) * 20);
  }

  this.awarenessScore = Math.round(Math.min(100, score));

  next();
});

module.exports = mongoose.model('BrandAwareness', brandAwarenessSchema);


