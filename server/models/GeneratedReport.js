// Generated Report Model
// Actual generated reports with data

const mongoose = require('mongoose');

const generatedReportSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true
  },
  // Report period
  period: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      default: 'monthly'
    }
  },
  // Generated data
  data: {
    metrics: [{
      metricId: String,
      value: mongoose.Schema.Types.Mixed,
      formattedValue: String,
      change: {
        value: Number,
        percentage: Number,
        trend: {
          type: String,
          enum: ['up', 'down', 'stable']
        }
      },
      benchmark: {
        value: mongoose.Schema.Types.Mixed,
        percentile: Number
      }
    }],
    charts: [{
      metricId: String,
      data: mongoose.Schema.Types.Mixed,
      chartType: String
    }],
    tables: [{
      metricId: String,
      data: [mongoose.Schema.Types.Mixed]
    }]
  },
  // AI-generated summary
  aiSummary: {
    text: String,
    keyHighlights: [String],
    recommendations: [String],
    generatedAt: Date,
    model: { type: String, default: 'gpt-4' }
  },
  // Export files
  exports: {
    pdf: {
      url: String,
      generatedAt: Date,
      size: Number
    },
    excel: {
      url: String,
      generatedAt: Date,
      size: Number
    },
    csv: {
      url: String,
      generatedAt: Date,
      size: Number
    }
  },
  // Status
  status: {
    type: String,
    enum: ['generating', 'completed', 'failed'],
    default: 'generating'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

generatedReportSchema.index({ clientWorkspaceId: 1, createdAt: -1 });
generatedReportSchema.index({ agencyWorkspaceId: 1, createdAt: -1 });
generatedReportSchema.index({ 'period.startDate': 1, 'period.endDate': 1 });

generatedReportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('GeneratedReport', generatedReportSchema);


