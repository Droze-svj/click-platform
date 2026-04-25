// Click Tracking Model
// Track clicks from social posts to landing pages

const mongoose = require('mongoose');

const clickTrackingSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  // UTM Parameters
  utm: {
    source: { type: String, index: true },
    medium: { type: String, index: true },
    campaign: { type: String, index: true },
    term: String,
    content: String
  },
  // Link Information
  link: {
    url: { type: String, required: true },
    shortUrl: String,
    linkId: String, // For branded link shortener
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true
    }
  },
  // Click Data
  click: {
    timestamp: { type: Date, default: Date.now },
    // Index defined below with compound indexes
    ipAddress: String,
    userAgent: String,
    referrer: String,
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
      index: true
    },
    browser: String,
    os: String,
    country: String,
    city: String,
    isUnique: { type: Boolean, default: true }
  },
  // Conversion Tracking
  conversion: {
    converted: { type: Boolean, default: false, index: true },
    conversionType: {
      type: String,
      enum: ['signup', 'lead', 'purchase', 'form_fill', 'download', 'other'],
      index: true
    },
    conversionValue: { type: Number, default: 0 },
    conversionTimestamp: Date,
    conversionId: String // External conversion ID
  },
  // Session Tracking
  session: {
    sessionId: String,
    isReturning: { type: Boolean, default: false },
    timeOnSite: Number,
    pagesViewed: Number,
    bounce: { type: Boolean, default: false }
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

clickTrackingSchema.index({ postId: 1, 'click.timestamp': -1 });
clickTrackingSchema.index({ workspaceId: 1, 'click.timestamp': -1 });
clickTrackingSchema.index({ 'utm.campaign': 1, 'click.timestamp': -1 });
clickTrackingSchema.index({ 'conversion.converted': 1, 'conversion.conversionType': 1 });
clickTrackingSchema.index({ 'link.campaignId': 1, 'click.timestamp': -1 });

module.exports = mongoose.model('ClickTracking', clickTrackingSchema);


