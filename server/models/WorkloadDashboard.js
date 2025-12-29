// Workload Dashboard Model
// Track workload and efficiency metrics per client

const mongoose = require('mongoose');

const workloadDashboardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true,
    index: true
  },
  // Period
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    type: { type: String, enum: ['week', 'month', 'quarter', 'year'], default: 'month' }
  },
  // Workload metrics
  workload: {
    postsCreated: { type: Number, default: 0 },
    postsScheduled: { type: Number, default: 0 },
    postsPublished: { type: Number, default: 0 },
    postsPerWeek: { type: Number, default: 0 },
    postsPerMonth: { type: Number, default: 0 },
    averagePostsPerDay: { type: Number, default: 0 },
    contentVariety: {
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
      video: { type: Number, default: 0 },
      carousel: { type: Number, default: 0 }
    }
  },
  // Efficiency metrics
  efficiency: {
    timeSaved: { type: Number, default: 0 }, // hours saved via automation
    automationRate: { type: Number, default: 0 }, // percentage of tasks automated
    averageTimePerPost: { type: Number, default: 0 }, // minutes
    tasksAutomated: { type: Number, default: 0 },
    tasksManual: { type: Number, default: 0 },
    efficiencyScore: { type: Number, default: 0 } // 0-100
  },
  // Content gaps
  contentGaps: {
    platforms: [{
      platform: String,
      currentPosts: Number,
      targetPosts: Number,
      gap: Number,
      gapPercentage: Number
    }],
    contentTypes: [{
      type: String,
      current: Number,
      target: Number,
      gap: Number
    }],
    topics: [{
      topic: String,
      current: Number,
      target: Number,
      gap: Number
    }],
    overallGapScore: { type: Number, default: 0 } // 0-100
  },
  // Profit indicators
  profit: {
    revenue: { type: Number, default: 0 },
    costs: {
      timeSpent: { type: Number, default: 0 }, // hours
      hourlyRate: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 }
    },
    profit: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 }, // percentage
    roi: { type: Number, default: 0 }, // return on investment
    valueGenerated: { type: Number, default: 0 }, // estimated value
    costPerPost: { type: Number, default: 0 },
    valuePerPost: { type: Number, default: 0 }
  },
  // Trends
  trends: {
    postsTrend: { type: String, enum: ['increasing', 'decreasing', 'stable'], default: 'stable' },
    efficiencyTrend: { type: String, enum: ['improving', 'declining', 'stable'], default: 'stable' },
    profitTrend: { type: String, enum: ['increasing', 'decreasing', 'stable'], default: 'stable' }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

workloadDashboardSchema.index({ userId: 1, clientId: 1, 'period.start': -1 });
workloadDashboardSchema.index({ userId: 1, 'period.start': -1 });

workloadDashboardSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate derived metrics
  if (this.workload.postsCreated > 0 && this.efficiency.averageTimePerPost > 0) {
    const totalTime = (this.workload.postsCreated * this.efficiency.averageTimePerPost) / 60; // hours
    this.efficiency.timeSaved = Math.max(0, totalTime - (this.efficiency.tasksAutomated * this.efficiency.averageTimePerPost / 60));
  }
  
  // Calculate profit
  if (this.profit.revenue > 0 && this.profit.costs.totalCost > 0) {
    this.profit.profit = this.profit.revenue - this.profit.costs.totalCost;
    this.profit.profitMargin = (this.profit.profit / this.profit.revenue) * 100;
    this.profit.roi = ((this.profit.profit - this.profit.costs.totalCost) / this.profit.costs.totalCost) * 100;
  }
  
  // Calculate cost per post
  if (this.workload.postsCreated > 0 && this.profit.costs.totalCost > 0) {
    this.profit.costPerPost = this.profit.costs.totalCost / this.workload.postsCreated;
  }
  
  next();
});

module.exports = mongoose.model('WorkloadDashboard', workloadDashboardSchema);


