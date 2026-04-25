// Comment Sentiment Model
// Track comment quality and sentiment

const mongoose = require('mongoose');

const commentSentimentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    required: true,
    index: true
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Comment Data
  comment: {
    id: { type: String, required: true },
    text: { type: String, required: true },
    author: {
      id: String,
      username: String,
      followers: Number,
      verified: Boolean
    },
    timestamp: { type: Date, required: true },
    // Index defined below with compound index
    platform: {
      type: String,
      enum: ['twitter', 'linkedin', 'facebook', 'instagram', 'youtube', 'tiktok'],
      required: true,
      index: true
    }
  },
  // Sentiment Analysis
  sentiment: {
    overall: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      required: true,
      index: true
    },
    scores: {
      positive: { type: Number, default: 0 }, // 0-100
      neutral: { type: Number, default: 0 },
      negative: { type: Number, default: 0 }
    },
    confidence: { type: Number, default: 0 } // 0-100
  },
  // Quality Assessment
  quality: {
    score: { type: Number, default: 0 }, // 0-100
    factors: {
      length: { type: Number, default: 0 }, // Optimal length
      relevance: { type: Number, default: 0 }, // Relevance to post
      engagement: { type: Number, default: 0 }, // Engagement potential
      authorCredibility: { type: Number, default: 0 } // Author influence
    },
    category: {
      type: String,
      enum: ['high_quality', 'medium_quality', 'low_quality', 'spam'],
      default: 'medium_quality'
      // Index defined below with schema.index()
    }
  },
  // Engagement
  engagement: {
    likes: { type: Number, default: 0 },
    replies: { type: Number, default: 0 },
    isPinned: { type: Boolean, default: false },
    isAuthorReply: { type: Boolean, default: false }
  },
  // Trends
  trends: {
    isTrending: { type: Boolean, default: false },
    velocity: { type: Number, default: 0 } // Engagement velocity
  },
  analyzedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSentimentSchema.index({ workspaceId: 1, 'comment.timestamp': -1 });
commentSentimentSchema.index({ postId: 1, 'sentiment.overall': 1 });
commentSentimentSchema.index({ 'quality.category': 1 });

module.exports = mongoose.model('CommentSentiment', commentSentimentSchema);


