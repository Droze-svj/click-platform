// Link Group Model
// Group links into campaigns or collections

const mongoose = require('mongoose');

const linkGroupSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['campaign', 'collection', 'ab_test'],
    default: 'campaign'
  },
  links: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BrandedLink'
  }],
  metadata: {
    campaign: String,
    tags: [String],
    startDate: Date,
    endDate: Date
  },
  analytics: {
    totalClicks: { type: Number, default: 0 },
    uniqueClicks: { type: Number, default: 0 },
    totalLinks: { type: Number, default: 0 },
    topLink: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BrandedLink'
    }
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

linkGroupSchema.index({ agencyWorkspaceId: 1, type: 1 });
linkGroupSchema.index({ clientWorkspaceId: 1 });

linkGroupSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('LinkGroup', linkGroupSchema);


