// Translation Glossary Model
// Stores domain-specific terminology and preferred translations

const mongoose = require('mongoose');

const glossaryTermSchema = new mongoose.Schema({
  term: {
    type: String,
    required: true
  },
  translation: {
    type: String,
    required: true
  },
  context: {
    type: String,
    default: ''
  },
  caseSensitive: {
    type: Boolean,
    default: false
  },
  preferred: {
    type: Boolean,
    default: true
  }
});

const translationGlossarySchema = new mongoose.Schema({
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
  description: {
    type: String,
    default: ''
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
  domain: {
    type: String,
    default: 'general'
  },
  terms: [glossaryTermSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  usageCount: {
    type: Number,
    default: 0
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
translationGlossarySchema.index({ userId: 1, sourceLanguage: 1, targetLanguage: 1 });
translationGlossarySchema.index({ userId: 1, isActive: 1, isDefault: 1 });
translationGlossarySchema.index({ domain: 1 });

translationGlossarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('TranslationGlossary', translationGlossarySchema);


