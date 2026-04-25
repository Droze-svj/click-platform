// Custom Benchmark Model
// Allows users to set their own performance benchmarks

const mongoose = require('mongoose');

const customBenchmarkSchema = new mongoose.Schema({
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
  metrics: {
    engagement: {
      target: { type: Number, default: null },
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    engagementRate: {
      target: { type: Number, default: null },
      min: { type: Number, default: null },
      max: { type: Number, default: null }
    },
    impressions: {
      target: { type: Number, default: null },
      min: { type: Number, default: null },
      max: { type: Number, default: null }
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

customBenchmarkSchema.index({ userId: 1, isActive: 1 });
customBenchmarkSchema.index({ platform: 1 });

customBenchmarkSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('CustomBenchmark', customBenchmarkSchema);


