// Template Performance Model
// Track template performance across clients

const mongoose = require('mongoose');

const templatePerformanceSchema = new mongoose.Schema({
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrossClientTemplate',
    required: true,
    index: true
  },
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  sourceContentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  generatedPosts: [{
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ScheduledPost'
    },
    platform: String,
    format: String,
    status: String
  }],
  metrics: {
    totalGenerated: { type: Number, default: 0 },
    successfullyPosted: { type: Number, default: 0 },
    totalEngagement: { type: Number, default: 0 },
    averageEngagement: { type: Number, default: 0 },
    totalReach: { type: Number, default: 0 },
    averageReach: { type: Number, default: 0 },
    engagementRate: { type: Number, default: 0 }
  },
  performance: {
    score: { type: Number, min: 0, max: 100, default: 0 },
    rating: {
      type: String,
      enum: ['excellent', 'good', 'average', 'poor'],
      default: 'average'
    }
  },
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

templatePerformanceSchema.index({ templateId: 1, appliedAt: -1 });
templatePerformanceSchema.index({ agencyWorkspaceId: 1, appliedAt: -1 });
templatePerformanceSchema.index({ 'performance.score': -1 });

templatePerformanceSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  
  // Calculate performance score
  if (this.metrics.totalGenerated > 0) {
    const successRate = (this.metrics.successfullyPosted / this.metrics.totalGenerated) * 100;
    const engagementScore = Math.min(this.metrics.averageEngagement / 10, 50);
    const reachScore = Math.min(this.metrics.averageReach / 100, 30);
    const rateScore = Math.min(this.metrics.engagementRate * 20, 20);
    
    this.performance.score = Math.round(successRate * 0.3 + engagementScore + reachScore + rateScore);
    
    if (this.performance.score >= 80) this.performance.rating = 'excellent';
    else if (this.performance.score >= 60) this.performance.rating = 'good';
    else if (this.performance.score >= 40) this.performance.rating = 'average';
    else this.performance.rating = 'poor';
  }
  
  next();
});

module.exports = mongoose.model('TemplatePerformance', templatePerformanceSchema);


