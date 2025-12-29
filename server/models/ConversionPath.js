// Conversion Path Model
// Track multi-touch conversion paths

const mongoose = require('mongoose');

const conversionPathSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  customerId: {
    type: String,
    required: true,
    index: true
  },
  conversionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversion',
    required: true,
    index: true
  },
  // Path Details
  path: {
    touchpoints: [{
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ScheduledPost'
      },
      platform: String,
      interaction: {
        type: String,
        enum: ['click', 'view', 'engagement', 'conversion']
      },
      timestamp: Date,
      value: Number
    }],
    totalTouchpoints: { type: Number, default: 0 },
    pathLength: { type: Number, default: 0 }, // Days from first to last
    firstTouch: Date,
    lastTouch: Date
  },
  // Attribution
  attribution: {
    model: {
      type: String,
      enum: ['first_touch', 'last_touch', 'linear', 'time_decay', 'position_based', 'data_driven'],
      default: 'last_touch'
    },
    credits: [{
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      credit: Number, // Percentage of credit
      value: Number // Attributed value
    }]
  },
  // Path Analysis
  analysis: {
    mostInfluentialTouchpoint: {
      postId: mongoose.Schema.Types.ObjectId,
      platform: String,
      reason: String
    },
    pathEfficiency: { type: Number, default: 0 }, // 0-100
    conversionProbability: { type: Number, default: 0 }, // 0-100
    bottlenecks: [String] // Identified bottlenecks
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

conversionPathSchema.index({ workspaceId: 1, customerId: 1 });
conversionPathSchema.index({ conversionId: 1 });
conversionPathSchema.index({ 'path.firstTouch': 1, 'path.lastTouch': 1 });

module.exports = mongoose.model('ConversionPath', conversionPathSchema);


