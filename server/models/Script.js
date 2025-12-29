// Script model for generated writing scripts

const mongoose = require('mongoose');

const scriptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['youtube', 'podcast', 'video', 'presentation', 'blog', 'social-media', 'email', 'sales'],
    required: true
  },
  topic: String,
  targetAudience: String,
  tone: {
    type: String,
    enum: ['professional', 'casual', 'friendly', 'authoritative', 'humorous', 'inspiring', 'educational'],
    default: 'professional'
  },
  duration: Number, // in minutes
  wordCount: Number,
  script: {
    type: String,
    required: true
  },
  structure: {
    introduction: String,
    mainPoints: [{
      title: String,
      content: String,
      duration: Number
    }],
    conclusion: String,
    callToAction: String
  },
  metadata: {
    keywords: [String],
    hashtags: [String],
    timestamps: [{
      time: String,
      section: String
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'completed', 'archived'],
    default: 'draft'
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

// Indexes
scriptSchema.index({ userId: 1, createdAt: -1 });
scriptSchema.index({ type: 1 });
scriptSchema.index({ status: 1 });

scriptSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Script', scriptSchema);







