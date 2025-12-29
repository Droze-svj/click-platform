// Video Metrics Model
// Track video-specific metrics

const mongoose = require('mongoose');

const videoMetricsSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    unique: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  platform: {
    type: String,
    enum: ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin'],
    required: true,
    index: true
  },
  // Video Details
  video: {
    duration: { type: Number, required: true }, // Seconds
    type: {
      type: String,
      enum: ['short_form', 'long_form'],
      required: true,
      index: true
    },
    format: {
      type: String,
      enum: ['vertical', 'horizontal', 'square'],
      default: 'vertical'
    }
  },
  // View Metrics
  views: {
    total: { type: Number, default: 0 },
    unique: { type: Number, default: 0 },
    organic: { type: Number, default: 0 },
    paid: { type: Number, default: 0 }
  },
  // Watch Time Metrics
  watchTime: {
    total: { type: Number, default: 0 }, // Total seconds watched
    average: { type: Number, default: 0 }, // Average seconds per view
    percentage: { type: Number, default: 0 } // Percentage of video watched
  },
  // Completion Metrics
  completion: {
    rate: { type: Number, default: 0 }, // Percentage who watched to end
    count: { type: Number, default: 0 }, // Number of completions
    averageCompletionTime: { type: Number, default: 0 } // Average time to completion
  },
  // View-Through Rate
  viewThroughRate: {
    type: Number,
    default: 0 // Percentage of impressions that resulted in views
  },
  // Retention Curve
  retention: {
    curve: [{
      second: { type: Number, required: true }, // Second in video
      percentage: { type: Number, required: true } // Percentage of viewers still watching
    }],
    averageRetention: { type: Number, default: 0 }, // Average retention percentage
    peakRetention: { type: Number, default: 0 }, // Peak retention percentage
    dropOffPoints: [{
      second: Number,
      percentage: Number,
      reason: String
    }]
  },
  // Engagement Metrics
  engagement: {
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    saves: { type: Number, default: 0 }
  },
  // Performance Score
  performanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },
  // Timestamps
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  syncedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

videoMetricsSchema.index({ workspaceId: 1, 'lastUpdated': -1 });
videoMetricsSchema.index({ platform: 1, 'video.type': 1, performanceScore: -1 });
videoMetricsSchema.index({ contentId: 1 });

// Calculate performance score before save
videoMetricsSchema.pre('save', function(next) {
  // Calculate view-through rate
  if (this.views.total > 0) {
    // Would need impressions from post analytics
    // For now, calculate based on views
    this.viewThroughRate = 0; // Placeholder
  }

  // Calculate completion rate
  if (this.views.total > 0) {
    this.completion.rate = (this.completion.count / this.views.total) * 100;
  }

  // Calculate watch time percentage
  if (this.video.duration > 0) {
    this.watchTime.percentage = (this.watchTime.average / this.video.duration) * 100;
  }

  // Calculate average retention
  if (this.retention.curve.length > 0) {
    this.retention.averageRetention = this.retention.curve.reduce((sum, point) => sum + point.percentage, 0) / this.retention.curve.length;
    this.retention.peakRetention = Math.max(...this.retention.curve.map(p => p.percentage));
  }

  // Calculate performance score (weighted)
  this.performanceScore = calculatePerformanceScore(this);

  next();
});

function calculatePerformanceScore(metrics) {
  let score = 0;

  // View-through rate (30%)
  score += (metrics.viewThroughRate / 100) * 30;

  // Completion rate (25%)
  score += (metrics.completion.rate / 100) * 25;

  // Average retention (20%)
  score += (metrics.retention.averageRetention / 100) * 20;

  // Engagement rate (15%)
  const totalEngagement = (metrics.engagement.likes || 0) + (metrics.engagement.comments || 0) + (metrics.engagement.shares || 0);
  const engagementRate = metrics.views.total > 0 ? (totalEngagement / metrics.views.total) * 100 : 0;
  score += Math.min(engagementRate / 10, 15); // Cap at 15%

  // Watch time (10%)
  score += (metrics.watchTime.percentage / 100) * 10;

  return Math.round(Math.min(100, score));
}

module.exports = mongoose.model('VideoMetrics', videoMetricsSchema);


