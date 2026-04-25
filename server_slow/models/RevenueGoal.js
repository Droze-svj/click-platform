// Revenue Goal Model
// Track revenue goals and progress

const mongoose = require('mongoose');

const revenueGoalSchema = new mongoose.Schema({
  workspaceId: {
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
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true
  },
  // Goal Details
  goal: {
    name: { type: String, required: true },
    description: String,
    targetRevenue: { type: Number, required: true },
    targetConversions: { type: Number, default: 0 },
    targetROAS: { type: Number, default: 0 },
    targetROI: { type: Number, default: 0 }
  },
  // Period
  period: {
    type: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Progress
  progress: {
    currentRevenue: { type: Number, default: 0 },
    currentConversions: { type: Number, default: 0 },
    currentROAS: { type: Number, default: 0 },
    currentROI: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    onTrack: { type: Boolean, default: true },
    projectedCompletion: Date
  },
  // Alerts
  alerts: {
    enabled: { type: Boolean, default: true },
    thresholds: [{
      percentage: Number,
      triggered: { type: Boolean, default: false },
      triggeredAt: Date
    }]
  },
  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'at_risk', 'failed', 'cancelled'],
    default: 'active',
    index: true
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

revenueGoalSchema.index({ workspaceId: 1, 'period.startDate': 1, status: 1 });
revenueGoalSchema.index({ clientWorkspaceId: 1, status: 1 });
revenueGoalSchema.index({ agencyWorkspaceId: 1, status: 1 });

revenueGoalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate progress percentage
  if (this.goal.targetRevenue > 0) {
    this.progress.percentage = (this.progress.currentRevenue / this.goal.targetRevenue) * 100;
  }
  
  // Check if on track
  const daysElapsed = (new Date() - new Date(this.period.startDate)) / (1000 * 60 * 60 * 24);
  const totalDays = (new Date(this.period.endDate) - new Date(this.period.startDate)) / (1000 * 60 * 60 * 24);
  const expectedProgress = (daysElapsed / totalDays) * 100;
  
  this.progress.onTrack = this.progress.percentage >= expectedProgress * 0.9; // 90% of expected
  
  // Update status
  if (this.progress.percentage >= 100) {
    this.status = 'completed';
  } else if (this.progress.percentage < expectedProgress * 0.7) {
    this.status = 'at_risk';
  }
  
  next();
});

module.exports = mongoose.model('RevenueGoal', revenueGoalSchema);


