// Internal Efficiency Model
// Track time, FTE, utilization metrics

const mongoose = require('mongoose');

const internalEfficiencySchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Period
  period: {
    type: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly', 'yearly'],
      required: true
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true }
  },
  // Team Metrics
  team: {
    totalFTE: { type: Number, default: 0 },
    activeFTE: { type: Number, default: 0 },
    billableFTE: { type: Number, default: 0 },
    utilizationRate: { type: Number, default: 0 }, // Percentage
    capacity: { type: Number, default: 0 } // Hours
  },
  // Time Tracking
  time: {
    totalHours: { type: Number, default: 0 },
    billableHours: { type: Number, default: 0 },
    nonBillableHours: { type: Number, default: 0 },
    perClient: [{
      clientWorkspaceId: mongoose.Schema.Types.ObjectId,
      clientName: String,
      hours: { type: Number, default: 0 },
      billableHours: { type: Number, default: 0 }
    }],
    perActivity: [{
      activity: String,
      hours: { type: Number, default: 0 }
    }]
  },
  // Content Metrics
  content: {
    totalPosts: { type: Number, default: 0 },
    postsPerFTE: { type: Number, default: 0 },
    postsPerHour: { type: Number, default: 0 },
    averageTimePerPost: { type: Number, default: 0 }, // Minutes
    contentVelocity: { type: Number, default: 0 } // Posts per day
  },
  // Revenue Metrics
  revenue: {
    totalRevenue: { type: Number, default: 0 },
    revenuePerFTE: { type: Number, default: 0 },
    revenuePerHour: { type: Number, default: 0 },
    revenuePerClient: { type: Number, default: 0 },
    perClient: [{
      clientWorkspaceId: mongoose.Schema.Types.ObjectId,
      clientName: String,
      revenue: { type: Number, default: 0 },
      hours: { type: Number, default: 0 },
      revenuePerHour: { type: Number, default: 0 }
    }]
  },
  // Efficiency Metrics
  efficiency: {
    timeToRevenueRatio: { type: Number, default: 0 },
    costPerPost: { type: Number, default: 0 },
    profitMargin: { type: Number, default: 0 }, // Percentage
    efficiencyScore: { type: Number, default: 0, min: 0, max: 100 }
  },
  // Benchmarks
  benchmarks: {
    industryUtilization: { type: Number, default: 75 }, // Percentage
    industryPostsPerFTE: { type: Number, default: 50 },
    industryRevenuePerFTE: { type: Number, default: 150000 }
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

internalEfficiencySchema.index({ agencyWorkspaceId: 1, 'period.startDate': -1 });
internalEfficiencySchema.index({ 'period.type': 1, 'period.startDate': -1 });

internalEfficiencySchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Calculate posts per FTE
  if (this.team.totalFTE > 0) {
    this.content.postsPerFTE = this.content.totalPosts / this.team.totalFTE;
  }

  // Calculate posts per hour
  if (this.time.totalHours > 0) {
    this.content.postsPerHour = this.content.totalPosts / this.time.totalHours;
  }

  // Calculate average time per post
  if (this.content.totalPosts > 0 && this.time.totalHours > 0) {
    this.content.averageTimePerPost = (this.time.totalHours / this.content.totalPosts) * 60; // Minutes
  }

  // Calculate content velocity
  const daysDiff = Math.ceil((this.period.endDate - this.period.startDate) / (1000 * 60 * 60 * 24));
  if (daysDiff > 0) {
    this.content.contentVelocity = this.content.totalPosts / daysDiff;
  }

  // Calculate revenue per FTE
  if (this.team.totalFTE > 0) {
    this.revenue.revenuePerFTE = this.revenue.totalRevenue / this.team.totalFTE;
  }

  // Calculate revenue per hour
  if (this.time.billableHours > 0) {
    this.revenue.revenuePerHour = this.revenue.totalRevenue / this.time.billableHours;
  }

  // Calculate revenue per client
  const clientCount = this.revenue.perClient.length;
  if (clientCount > 0) {
    this.revenue.revenuePerClient = this.revenue.totalRevenue / clientCount;
  }

  // Calculate utilization rate
  if (this.team.capacity > 0) {
    this.team.utilizationRate = (this.time.billableHours / this.team.capacity) * 100;
  }

  // Calculate time to revenue ratio
  if (this.time.totalHours > 0) {
    this.efficiency.timeToRevenueRatio = this.revenue.totalRevenue / this.time.totalHours;
  }

  // Calculate efficiency score
  let score = 0;
  
  // Utilization (30%)
  const utilizationScore = Math.min(30, (this.team.utilizationRate / 100) * 30);
  score += utilizationScore;

  // Revenue per FTE (25%)
  const revenuePerFTEScore = Math.min(25, (this.revenue.revenuePerFTE / this.benchmarks.industryRevenuePerFTE) * 25);
  score += revenuePerFTEScore;

  // Posts per FTE (20%)
  const postsPerFTEScore = Math.min(20, (this.content.postsPerFTE / this.benchmarks.industryPostsPerFTE) * 20);
  score += postsPerFTEScore;

  // Revenue per hour (15%)
  const revenuePerHourScore = Math.min(15, (this.revenue.revenuePerHour / 200) * 15); // $200/hour benchmark
  score += revenuePerHourScore;

  // Profit margin (10%)
  const profitMarginScore = Math.min(10, (this.efficiency.profitMargin / 20) * 10); // 20% margin benchmark
  score += profitMarginScore;

  this.efficiency.efficiencyScore = Math.round(score);

  next();
});

module.exports = mongoose.model('InternalEfficiency', internalEfficiencySchema);


