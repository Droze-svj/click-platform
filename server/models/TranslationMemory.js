// Translation Memory Model
// Stores previously translated phrases for reuse

const mongoose = require('mongoose');

const translationMemorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sourceLanguage: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  targetLanguage: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  sourceText: {
    type: String,
    required: true,
    index: true
  },
  targetText: {
    type: String,
    required: true
  },
  context: {
    type: String,
    default: ''
  },
  domain: {
    type: String,
    default: 'general'
  },
  usageCount: {
    type: Number,
    default: 1
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  qualityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 80
  },
  metadata: {
    createdBy: {
      type: String,
      enum: ['system', 'user', 'ai'],
      default: 'system'
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedAt: Date
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

// Compound indexes for efficient lookups
translationMemorySchema.index({ userId: 1, sourceLanguage: 1, targetLanguage: 1 });
translationMemorySchema.index({ sourceText: 1, sourceLanguage: 1, targetLanguage: 1 });
translationMemorySchema.index({ userId: 1, domain: 1 });

// Text index for fuzzy matching
translationMemorySchema.index({ sourceText: 'text' });

translationMemorySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('TranslationMemory', translationMemorySchema);


