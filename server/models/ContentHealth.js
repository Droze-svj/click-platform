// Content Health Model
// AI-powered content health analysis per client

const mongoose = require('mongoose');

const contentHealthSchema = new mongoose.Schema({
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
  analysisDate: {
    type: Date,
    default: Date.now
  },
  overallScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  scores: {
    freshness: {
      type: Number,
      min: 0,
      max: 100
    },
    diversity: {
      type: Number,
      min: 0,
      max: 100
    },
    engagement: {
      type: Number,
      min: 0,
      max: 100
    },
    consistency: {
      type: Number,
      min: 0,
      max: 100
    },
    relevance: {
      type: Number,
      min: 0,
      max: 100
    },
    volume: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  platformBreakdown: [{
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
      required: true
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    metrics: {
      postsCount: Number,
      averageEngagement: Number,
      engagementRate: Number,
      reach: Number,
      impressions: Number
    },
    issues: [{
      type: {
        type: String,
        enum: ['low_engagement', 'inconsistent_posting', 'outdated_content', 'low_diversity', 'missing_cta', 'poor_timing']
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      description: String,
      recommendation: String
    }]
  }],
  gaps: [{
    category: {
      type: String,
      enum: ['topic', 'format', 'platform', 'timing', 'audience', 'cta', 'hashtag']
    },
    description: String,
    impact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    recommendation: String,
    priority: {
      type: Number,
      min: 1,
      max: 10
    }
  }],
  strengths: [String],
  opportunities: [{
    type: {
      type: String,
      enum: ['new_platform', 'new_format', 'new_topic', 'better_timing', 'audience_expansion', 'content_series']
    },
    description: String,
    potentialImpact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    effort: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],
  aiInsights: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  metadata: {
    niche: String,
    industry: String,
    targetAudience: String,
    contentTypes: [String],
    platforms: [String]
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

contentHealthSchema.index({ clientWorkspaceId: 1, analysisDate: -1 });
contentHealthSchema.index({ agencyWorkspaceId: 1, analysisDate: -1 });
contentHealthSchema.index({ 'metadata.niche': 1, analysisDate: -1 });
contentHealthSchema.index({ overallScore: 1 });

contentHealthSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ContentHealth', contentHealthSchema);


