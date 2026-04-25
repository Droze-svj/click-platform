// Client Report Model
// White-label reports for clients

const mongoose = require('mongoose');

const clientReportSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  reportType: {
    type: String,
    enum: ['weekly', 'monthly', 'quarterly', 'custom', 'campaign'],
    required: true
  },
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
  },
  branding: {
    logo: String,
    primaryColor: String,
    secondaryColor: String,
    customCSS: String
  },
  sections: [{
    sectionType: {
      type: String,
      enum: ['overview', 'content', 'engagement', 'platforms', 'top_posts', 'recommendations', 'custom'],
      required: true
    },
    title: String,
    data: mongoose.Schema.Types.Mixed,
    order: Number
  }],
  metrics: {
    totalPosts: { type: Number, default: 0 },
    totalEngagement: { type: Number, default: 0 },
    avgEngagement: { type: Number, default: 0 },
    topPlatform: String,
    contentCreated: { type: Number, default: 0 },
    growthRate: { type: Number, default: 0 }
  },
  insights: [{
    type: { type: String, enum: ['success', 'opportunity', 'warning', 'info'] },
    title: String,
    description: String,
    recommendation: String
  }],
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'viewed'],
    default: 'draft',
    index: true
  },
  generatedAt: Date,
  sentAt: Date,
  viewedAt: Date,
  viewedBy: [{
    userId: mongoose.Schema.Types.ObjectId,
    viewedAt: Date
  }],
  pdfUrl: String,
  shareUrl: String,
  isPublic: { type: Boolean, default: false },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

clientReportSchema.index({ agencyWorkspaceId: 1, clientWorkspaceId: 1, period: 1 });
clientReportSchema.index({ status: 1, generatedAt: -1 });

clientReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ClientReport', clientReportSchema);


