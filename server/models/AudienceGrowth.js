// Audience Growth Model
// Track follower changes, growth rate, and churn per platform

const mongoose = require('mongoose');

const audienceGrowthSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  platformAccountId: {
    type: String,
    required: true,
    index: true
  },
  snapshotDate: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  followers: {
    current: {
      type: Number,
      required: true,
      default: 0
    },
    previous: {
      type: Number,
      default: 0
    },
    change: {
      type: Number,
      default: 0
    },
    changePercentage: {
      type: Number,
      default: 0
    }
  },
  following: {
    type: Number,
    default: 0
  },
  growth: {
    newFollowers: {
      type: Number,
      default: 0
    },
    lostFollowers: {
      type: Number,
      default: 0
    },
    netGrowth: {
      type: Number,
      default: 0
    },
    growthRate: {
      type: Number,
      default: 0 // Percentage
    },
    churnRate: {
      type: Number,
      default: 0 // Percentage
    }
  },
  period: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily'
    },
    startDate: Date,
    endDate: Date
  },
  metadata: {
    platformUsername: String,
    accountType: String, // personal, business, creator
    verified: Boolean,
    bio: String,
    profileImageUrl: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

audienceGrowthSchema.index({ userId: 1, platform: 1, snapshotDate: -1 });
audienceGrowthSchema.index({ workspaceId: 1, platform: 1, snapshotDate: -1 });
audienceGrowthSchema.index({ platformAccountId: 1, snapshotDate: -1 });

// Calculate growth metrics before save
audienceGrowthSchema.pre('save', function(next) {
  // Calculate change
  if (this.followers.previous !== undefined && this.followers.previous !== null) {
    this.followers.change = this.followers.current - this.followers.previous;
    if (this.followers.previous > 0) {
      this.followers.changePercentage = (this.followers.change / this.followers.previous) * 100;
    }
  }

  // Calculate growth rate
  if (this.followers.previous > 0) {
    this.growth.growthRate = (this.growth.netGrowth / this.followers.previous) * 100;
  }

  // Calculate churn rate
  if (this.followers.previous > 0 && this.growth.lostFollowers > 0) {
    this.growth.churnRate = (this.growth.lostFollowers / this.followers.previous) * 100;
  }

  next();
});

module.exports = mongoose.model('AudienceGrowth', audienceGrowthSchema);


