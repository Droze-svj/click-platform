// Report Template Model
// White-label report templates with drag-and-drop metrics

const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'reach',
      'impressions',
      'engagement_rate',
      'ctr',
      'conversions',
      'roi',
      'roas',
      'brand_awareness',
      'sentiment',
      'benchmark',
      'health_score',
      'audience_growth',
      'follower_count',
      'engagement_total',
      'revenue',
      'cost',
      'custom'
    ],
    required: true
  },
  label: { type: String, required: true },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 100 }
  },
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  format: {
    type: String,
    enum: ['number', 'percentage', 'currency', 'chart', 'table', 'text'],
    default: 'number'
  },
  chartType: {
    type: String,
    enum: ['line', 'bar', 'pie', 'area', 'donut', null],
    default: null
  }
});

const reportTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  isPublic: {
    type: Boolean,
    default: false // false = client-specific, true = available to all clients
  },
  // White-label branding
  branding: {
    logo: String,
    primaryColor: { type: String, default: '#3B82F6' },
    secondaryColor: { type: String, default: '#1E40AF' },
    fontFamily: { type: String, default: 'Arial' },
    companyName: String,
    contactEmail: String,
    contactPhone: String,
    website: String
  },
  // Layout
  layout: {
    type: {
      type: String,
      enum: ['single', 'multi', 'dashboard'],
      default: 'multi'
    },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape'],
      default: 'portrait'
    },
    pageSize: {
      type: String,
      enum: ['A4', 'Letter', 'Legal'],
      default: 'A4'
    }
  },
  // Metrics (drag-and-drop)
  metrics: [metricSchema],
  // Sections
  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, required: true },
    metrics: [String] // Metric IDs in this section
  }],
  // AI Summary settings
  aiSummary: {
    enabled: { type: Boolean, default: true },
    tone: {
      type: String,
      enum: ['professional', 'friendly', 'formal', 'casual'],
      default: 'professional'
    },
    length: {
      type: String,
      enum: ['short', 'medium', 'long'],
      default: 'medium'
    },
    includeRecommendations: { type: Boolean, default: true }
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

reportTemplateSchema.index({ agencyWorkspaceId: 1, clientWorkspaceId: 1 });
reportTemplateSchema.index({ agencyWorkspaceId: 1, isDefault: 1 });

reportTemplateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ReportTemplate', reportTemplateSchema);
