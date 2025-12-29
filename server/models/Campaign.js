// Campaign Model
// Campaigns that can be cloned across multiple clients

const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  templateContent: {
    title: String,
    description: String,
    text: String,
    mediaUrl: String,
    hashtags: [String],
    mentions: [String],
    platforms: [String]
  },
  brandGuidelines: {
    primaryColor: String,
    secondaryColor: String,
    logo: String,
    font: String,
    tone: String,
    voice: String,
    doNotUse: [String], // Words/phrases to avoid
    mustInclude: [String] // Words/phrases to include
  },
  scheduling: {
    startDate: Date,
    endDate: Date,
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly', 'custom'],
      default: 'weekly'
    },
    daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
    times: [String], // ["09:00", "15:00", "18:00"]
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  platforms: [{
    type: String,
    enum: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'facebook', 'pinterest', 'threads', 'snapchat', 'reddit']
  }],
  variations: {
    enabled: { type: Boolean, default: true },
    headlineVariations: [String],
    captionVariations: [String],
    hashtagVariations: [[String]]
  },
  approvalWorkflow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalWorkflow'
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
    default: 'draft',
    index: true
  },
  clientInstances: [{
    clientWorkspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true
    },
    customizedContent: {
      title: String,
      description: String,
      text: String,
      mediaUrl: String,
      hashtags: [String],
      brandGuidelines: mongoose.Schema.Types.Mixed
    },
    scheduledPosts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    }],
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'active', 'completed', 'cancelled'],
      default: 'pending'
    },
    scheduledAt: Date,
    completedAt: Date
  }],
  metadata: {
    tags: [String],
    category: String,
    notes: String
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

campaignSchema.index({ agencyWorkspaceId: 1, status: 1 });
campaignSchema.index({ createdBy: 1, status: 1 });
campaignSchema.index({ 'clientInstances.clientWorkspaceId': 1 });

campaignSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Campaign', campaignSchema);


