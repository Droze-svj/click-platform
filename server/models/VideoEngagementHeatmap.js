// Video Engagement Heatmap Model
// Track engagement hotspots in videos

const mongoose = require('mongoose');

const videoEngagementHeatmapSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    unique: true,
    index: true
  },
  videoMetricsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VideoMetrics',
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  // Heatmap Data
  heatmap: {
    data: [{
      second: { type: Number, required: true },
      engagement: { type: Number, default: 0 }, // Likes, comments, shares at this second
      views: { type: Number, default: 0 }, // Views at this second
      retention: { type: Number, default: 0 }, // Percentage still watching
      intensity: { type: Number, default: 0 } // Combined intensity score
    }],
    hotspots: [{
      startSecond: { type: Number, required: true },
      endSecond: { type: Number, required: true },
      intensity: { type: Number, required: true },
      type: {
        type: String,
        enum: ['high_engagement', 'high_retention', 'drop_off', 'peak']
      },
      reason: String
    }],
    averageIntensity: { type: Number, default: 0 }
  },
  // Engagement Patterns
  patterns: {
    peakEngagement: {
      second: Number,
      value: Number
    },
    dropOffPoints: [{
      second: Number,
      percentage: Number,
      reason: String
    }],
    reEngagementPoints: [{
      second: Number,
      percentage: Number
    }]
  },
  // Analysis
  analysis: {
    bestSegment: {
      startSecond: Number,
      endSecond: Number,
      reason: String
    },
    worstSegment: {
      startSecond: Number,
      endSecond: Number,
      reason: String
    },
    recommendations: [String]
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

videoEngagementHeatmapSchema.index({ workspaceId: 1, updatedAt: -1 });
videoEngagementHeatmapSchema.index({ postId: 1 });

videoEngagementHeatmapSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate average intensity
  if (this.heatmap.data.length > 0) {
    this.heatmap.averageIntensity = this.heatmap.data.reduce((sum, point) => sum + point.intensity, 0) / this.heatmap.data.length;
  }

  next();
});

module.exports = mongoose.model('VideoEngagementHeatmap', videoEngagementHeatmapSchema);


