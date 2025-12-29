// Report Comparison Model
// Period-over-period comparisons

const mongoose = require('mongoose');

const reportComparisonSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportTemplate',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Periods being compared
  periods: {
    current: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedReport'
      }
    },
    previous: {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reportId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedReport'
      }
    }
  },
  // Comparison data
  comparisons: [{
    metricId: String,
    metricType: String,
    current: {
      value: mongoose.Schema.Types.Mixed,
      formattedValue: String
    },
    previous: {
      value: mongoose.Schema.Types.Mixed,
      formattedValue: String
    },
    change: {
      value: Number,
      percentage: Number,
      trend: {
        type: String,
        enum: ['up', 'down', 'stable']
      }
    },
    significance: {
      type: String,
      enum: ['significant', 'moderate', 'minor'],
      default: 'minor'
    }
  }],
  // AI-generated comparison summary
  aiSummary: {
    text: String,
    keyChanges: [String],
    insights: [String],
    recommendations: [String],
    generatedAt: Date
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

reportComparisonSchema.index({ clientWorkspaceId: 1, createdAt: -1 });
reportComparisonSchema.index({ agencyWorkspaceId: 1, createdAt: -1 });

reportComparisonSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ReportComparison', reportComparisonSchema);


