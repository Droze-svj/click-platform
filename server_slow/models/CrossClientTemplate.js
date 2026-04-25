// Cross-Client Content Template Model
// Reusable templates that agencies can apply to any client

const mongoose = require('mongoose');

const crossClientTemplateSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  sourceType: {
    type: String,
    enum: ['podcast', 'video', 'article', 'transcript', 'live_stream', 'webinar'],
    required: true
  },
  outputs: [{
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
      required: true
    },
    format: {
      type: String,
      enum: ['short_clip', 'post', 'carousel', 'story', 'reel', 'tweet', 'article'],
      required: true
    },
    count: {
      type: Number,
      required: true,
      min: 1
    },
    config: {
      duration: Number, // seconds for clips
      aspectRatio: String, // e.g., "9:16", "16:9", "1:1"
      maxLength: Number, // characters for posts
      includeHashtags: { type: Boolean, default: true },
      includeCaptions: { type: Boolean, default: true },
      style: String, // e.g., "educational", "entertaining", "promotional"
      tone: String // e.g., "professional", "casual", "humorous"
    }
  }],
  processingRules: {
    extractKeyPoints: { type: Boolean, default: true },
    generateCaptions: { type: Boolean, default: true },
    addBranding: { type: Boolean, default: false },
    optimizeForPlatform: { type: Boolean, default: true },
    includeCTAs: { type: Boolean, default: false },
    ctaText: String
  },
  aiConfig: {
    useAI: { type: Boolean, default: true },
    model: { type: String, default: 'gpt-4' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: Number,
    customPrompts: mongoose.Schema.Types.Mixed
  },
  tags: [String],
  category: {
    type: String,
    enum: ['podcast', 'video', 'article', 'educational', 'promotional', 'entertainment', 'news', 'custom'],
    default: 'custom'
  },
  isPublic: {
    type: Boolean,
    default: false // false = agency-only, true = shared across agency
  },
  usageCount: {
    type: Number,
    default: 0
  },
  successRate: {
    type: Number,
    default: 0 // Percentage of successful applications
  },
  averageEngagement: {
    type: Number,
    default: 0 // Average engagement rate
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

crossClientTemplateSchema.index({ agencyWorkspaceId: 1, sourceType: 1 });
crossClientTemplateSchema.index({ agencyWorkspaceId: 1, category: 1 });
crossClientTemplateSchema.index({ agencyWorkspaceId: 1, isPublic: 1 });

crossClientTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CrossClientTemplate', crossClientTemplateSchema);


