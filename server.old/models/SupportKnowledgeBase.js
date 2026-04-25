// Support Knowledge Base Model
// Articles and solutions for support team

const mongoose = require('mongoose');

const knowledgeBaseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['billing', 'technical', 'feature', 'troubleshooting', 'faq', 'other'],
    required: true,
    index: true
  },
  tags: [String],
  // Solutions
  solutions: [{
    problem: String,
    solution: String,
    steps: [String]
  }],
  // Related articles
  relatedArticles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportKnowledgeBase'
  }],
  // Usage stats
  stats: {
    views: { type: Number, default: 0 },
    helpful: { type: Number, default: 0 },
    notHelpful: { type: Number, default: 0 },
    usedInTickets: { type: Number, default: 0 }
  },
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published',
    index: true
  },
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // SEO
  keywords: [String],
  searchableText: String, // Full-text search
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

knowledgeBaseSchema.index({ category: 1, status: 1 });
knowledgeBaseSchema.index({ tags: 1 });
knowledgeBaseSchema.index({ title: 'text', content: 'text', searchableText: 'text' });

knowledgeBaseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Generate searchable text
  this.searchableText = `${this.title} ${this.content} ${this.tags.join(' ')}`;
  
  next();
});

module.exports = mongoose.model('SupportKnowledgeBase', knowledgeBaseSchema);


