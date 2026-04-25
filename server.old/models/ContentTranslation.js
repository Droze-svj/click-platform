// Content Translation Model
// Stores translations of content in multiple languages

const mongoose = require('mongoose');

const contentTranslationSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  language: {
    type: String,
    required: true,
    index: true,
    uppercase: true
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  body: {
    type: String,
    default: ''
  },
  transcript: {
    type: String,
    default: ''
  },
  caption: {
    type: String,
    default: ''
  },
  hashtags: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  metadata: {
    translationMethod: {
      type: String,
      enum: ['auto', 'manual', 'ai', 'hybrid'],
      default: 'auto'
    },
    translatedAt: {
      type: Date,
      default: Date.now
    },
    translator: {
      type: String,
      default: 'system'
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    culturalAdaptation: {
      type: Boolean,
      default: false
    },
    platformOptimizations: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'published'],
    default: 'draft'
  },
  isPrimary: {
    type: Boolean,
    default: false
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

// Compound indexes
contentTranslationSchema.index({ contentId: 1, language: 1 }, { unique: true });
contentTranslationSchema.index({ userId: 1, language: 1, status: 1 });
contentTranslationSchema.index({ contentId: 1, isPrimary: 1 });
// Note: contentId and userId already have compound indexes above

contentTranslationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('ContentTranslation', contentTranslationSchema);


