// Conversion Model
// Track conversions from social traffic

const mongoose = require('mongoose');

const conversionSchema = new mongoose.Schema({
  clickId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ClickTracking',
    index: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
    required: true,
    index: true
  },
  // Conversion Details
  conversionType: {
    type: String,
    enum: ['signup', 'lead', 'purchase', 'form_fill', 'download', 'trial', 'subscription', 'other'],
    required: true,
    index: true
  },
  conversionValue: {
    type: Number,
    default: 0,
    index: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  // Attribution
  attribution: {
    source: String, // UTM source
    medium: String, // UTM medium
    campaign: String, // UTM campaign
    firstTouch: { type: Boolean, default: true },
    lastTouch: { type: Boolean, default: true },
    touchpoints: [{
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      timestamp: Date,
      interaction: String
    }]
  },
  // Conversion Data
  conversionData: {
    timestamp: { type: Date, default: Date.now }
    // Index defined below with compound indexes
    conversionId: String, // External ID
    customerId: String,
    orderId: String,
    productId: String,
    quantity: Number,
    metadata: mongoose.Schema.Types.Mixed
  },
  // Funnel Tracking
  funnel: {
    stage: {
      type: String,
      enum: ['awareness', 'interest', 'consideration', 'purchase', 'retention'],
      index: true
    },
    previousStage: String,
    timeToConvert: Number, // Hours from click to conversion
    touchpoints: Number
  },
  // Revenue Attribution
  revenue: {
    gross: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    lifetimeValue: { type: Number, default: 0 },
    attributed: { type: Number, default: 0 } // Revenue attributed to this conversion
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

conversionSchema.index({ workspaceId: 1, 'conversionData.timestamp': -1 });
conversionSchema.index({ postId: 1, 'conversionData.timestamp': -1 });
conversionSchema.index({ platform: 1, conversionType: 1, 'conversionData.timestamp': -1 });
conversionSchema.index({ 'attribution.campaign': 1, 'conversionData.timestamp': -1 });
conversionSchema.index({ 'funnel.stage': 1, 'conversionData.timestamp': -1 });

module.exports = mongoose.model('Conversion', conversionSchema);


