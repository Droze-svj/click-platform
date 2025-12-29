// White Label Portal Model
// Client-facing portals for agencies

const mongoose = require('mongoose');

const whiteLabelPortalSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  subdomain: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  customDomain: {
    type: String,
    default: null
  },
  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String,
    favicon: String,
    customCSS: String,
    customHTML: String
  },
  settings: {
    showAgencyBranding: { type: Boolean, default: false },
    allowClientPosting: { type: Boolean, default: false },
    allowClientScheduling: { type: Boolean, default: true },
    allowClientAnalytics: { type: Boolean, default: true },
    allowClientApprovals: { type: Boolean, default: true },
    showPricing: { type: Boolean, default: false },
    customFooter: String,
    customHeader: String
  },
  features: {
    contentLibrary: { type: Boolean, default: true },
    approvalWorkflow: { type: Boolean, default: true },
    analytics: { type: Boolean, default: true },
    scheduling: { type: Boolean, default: true },
    reporting: { type: Boolean, default: true }
  },
  access: {
    publicUrl: String,
    requiresAuth: { type: Boolean, default: true },
    allowedEmails: [String],
    allowedDomains: [String]
  },
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

whiteLabelPortalSchema.index({ workspaceId: 1, clientId: 1 });
whiteLabelPortalSchema.index({ subdomain: 1 });

whiteLabelPortalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('WhiteLabelPortal', whiteLabelPortalSchema);


