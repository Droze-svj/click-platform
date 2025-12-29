// AI Confidence Score Model
// Track AI confidence and edit effort for content

const mongoose = require('mongoose');

const confidenceScoreSchema = new mongoose.Schema({
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledPost',
    index: true
  },
  // Overall confidence score (0-100)
  overallConfidence: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  // Confidence by aspect
  aspectConfidence: {
    tone: { type: Number, min: 0, max: 100 },
    humor: { type: Number, min: 0, max: 100 },
    sarcasm: { type: Number, min: 0, max: 100 },
    sensitivity: { type: Number, min: 0, max: 100 },
    brandAlignment: { type: Number, min: 0, max: 100 },
    clarity: { type: Number, min: 0, max: 100 },
    engagement: { type: Number, min: 0, max: 100 }
  },
  // Uncertainty flags
  uncertaintyFlags: [{
    type: {
      type: String,
      enum: [
        'humor_detected',
        'sarcasm_detected',
        'sensitive_topic',
        'ambiguous_tone',
        'brand_mismatch',
        'low_clarity',
        'complex_language',
        'cultural_reference',
        'slang_detected',
        'controversial_content'
      ]
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    message: String,
    suggestion: String
  }],
  // Edit effort estimate (0-100, higher = more effort needed)
  editEffort: {
    type: Number,
    min: 0,
    max: 100,
    required: true
  },
  // Human review recommendation
  needsHumanReview: {
    type: Boolean,
    default: false
  },
  reviewReason: String,
  // Confidence breakdown
  confidenceBreakdown: {
    textAnalysis: { type: Number, min: 0, max: 100 },
    contextAnalysis: { type: Number, min: 0, max: 100 },
    brandCompliance: { type: Number, min: 0, max: 100 },
    platformFit: { type: Number, min: 0, max: 100 }
  },
  // AI model used
  model: {
    type: String,
    default: 'gpt-4'
  },
  // Analysis metadata
  analysisMetadata: {
    detectedTopics: [String],
    detectedSentiment: String,
    languageComplexity: String,
    readingLevel: String
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

confidenceScoreSchema.index({ contentId: 1, createdAt: -1 });
confidenceScoreSchema.index({ needsHumanReview: 1, createdAt: -1 });
confidenceScoreSchema.index({ overallConfidence: 1 });

confidenceScoreSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Auto-determine if human review needed
  if (!this.needsHumanReview) {
    this.needsHumanReview = this.overallConfidence < 70 || 
                           this.editEffort > 50 ||
                           this.uncertaintyFlags.some(f => f.severity === 'high' || f.severity === 'critical');
  }
  
  next();
});

module.exports = mongoose.model('AIConfidenceScore', confidenceScoreSchema);


