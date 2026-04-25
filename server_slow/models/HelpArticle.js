// Help Article Model

const mongoose = require('mongoose');

const helpArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  content: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: ['getting-started', 'features', 'troubleshooting', 'billing', 'api', 'other'],
  },
  tags: [{
    type: String,
  }],
  views: {
    type: Number,
    default: 0,
  },
  helpful: {
    type: Number,
    default: 0,
  },
  notHelpful: {
    type: Number,
    default: 0,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  published: {
    type: Boolean,
    default: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

helpArticleSchema.index({ category: 1, published: 1 });
// Note: slug already has unique: true in field definition, so no need to index again
helpArticleSchema.index({ featured: 1, published: 1 });
helpArticleSchema.index({ tags: 1 });

helpArticleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('HelpArticle', helpArticleSchema);






