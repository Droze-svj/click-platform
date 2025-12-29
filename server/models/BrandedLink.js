// Branded Link Model
// Shortened links with agency/client branding

const mongoose = require('mongoose');

const brandedLinkSchema = new mongoose.Schema({
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalUrl: {
    type: String,
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  domain: {
    type: String,
    default: null // Custom domain for branded links
  },
  customPath: {
    type: String,
    default: null // Custom path (e.g., /go/product-launch)
  },
  metadata: {
    title: String,
    description: String,
    tags: [String],
    campaign: String,
    source: String
  },
  tracking: {
    enabled: { type: Boolean, default: true },
    trackClicks: { type: Boolean, default: true },
    trackGeolocation: { type: Boolean, default: false },
    trackDevice: { type: Boolean, default: true },
    trackReferrer: { type: Boolean, default: true },
    trackUTM: { type: Boolean, default: true }
  },
  analytics: {
    totalClicks: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    lastClicked: Date,
    clicksByDate: [{
      date: Date,
      clicks: Number,
      uniqueClicks: Number
    }],
    clicksByCountry: [{
      country: String,
      clicks: Number
    }],
    clicksByDevice: [{
      device: String,
      clicks: Number
    }],
    clicksByReferrer: [{
      referrer: String,
      clicks: Number
    }]
  },
  expirationDate: Date,
  isActive: {
    type: Boolean,
    default: true
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

brandedLinkSchema.index({ agencyWorkspaceId: 1, createdAt: -1 });
brandedLinkSchema.index({ clientWorkspaceId: 1, createdAt: -1 });
brandedLinkSchema.index({ shortCode: 1 }, { unique: true });
brandedLinkSchema.index({ 'analytics.lastClicked': -1 });

brandedLinkSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('BrandedLink', brandedLinkSchema);


