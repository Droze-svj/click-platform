// Benchmark Goal Model
// Track goals based on benchmarks

const mongoose = require('mongoose');

const benchmarkGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  platform: {
    type: String,
    enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok', 'all'],
    default: 'all'
  },
  metric: {
    type: String,
    enum: ['engagement', 'engagementRate', 'impressions', 'percentile'],
    required: true
  },
  targetValue: {
    type: Number,
    required: true
  },
  currentValue: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'failed', 'paused'],
    default: 'active'
  },
  milestones: [{
    value: Number,
    label: String,
    achieved: { type: Boolean, default: false },
    achievedAt: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

benchmarkGoalSchema.index({ userId: 1, status: 1 });
benchmarkGoalSchema.index({ endDate: 1 });

benchmarkGoalSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate progress
  if (this.targetValue > 0) {
    this.progress = Math.min(100, Math.max(0, (this.currentValue / this.targetValue) * 100));
  }
  
  // Update status
  if (this.progress >= 100 && this.status === 'active') {
    this.status = 'completed';
  } else if (new Date() > this.endDate && this.status === 'active' && this.progress < 100) {
    this.status = 'failed';
  }
  
  next();
});

module.exports = mongoose.model('BenchmarkGoal', benchmarkGoalSchema);


