// Client Satisfaction Model
// Track NPS and satisfaction scores

const mongoose = require('mongoose');

const clientSatisfactionSchema = new mongoose.Schema({
  agencyWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  clientWorkspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Survey Details
  survey: {
    type: {
      type: String,
      enum: ['nps', 'csat', 'ces', 'custom'],
      required: true,
      index: true
    },
    date: { type: Date, required: true, index: true },
    sentBy: mongoose.Schema.Types.ObjectId,
    completedAt: Date,
    status: {
      type: String,
      enum: ['sent', 'completed', 'reminded', 'expired'],
      default: 'sent',
      index: true
    }
  },
  // NPS Score
  nps: {
    score: {
      type: Number,
      min: 0,
      max: 10,
      index: true
    },
    category: {
      type: String,
      enum: ['promoter', 'passive', 'detractor'],
      index: true
    },
    comment: String
  },
  // CSAT Score
  csat: {
    score: {
      type: Number,
      min: 1,
      max: 5,
      index: true
    },
    question: String,
    comment: String
  },
  // CES Score (Customer Effort Score)
  ces: {
    score: {
      type: Number,
      min: 1,
      max: 7
    },
    question: String,
    comment: String
  },
  // Custom Questions
  customQuestions: [{
    question: String,
    answer: mongoose.Schema.Types.Mixed,
    type: {
      type: String,
      enum: ['rating', 'text', 'multiple_choice']
    }
  }],
  // Overall Satisfaction
  overallSatisfaction: {
    score: { type: Number, default: 0, min: 0, max: 100 },
    factors: {
      service: Number,
      results: Number,
      communication: Number,
      value: Number,
      support: Number
    }
  },
  // Feedback
  feedback: {
    positive: [String],
    negative: [String],
    suggestions: [String],
    verbatim: String
  },
  // Follow-up
  followUp: {
    required: { type: Boolean, default: false },
    scheduledDate: Date,
    completedDate: Date,
    actionItems: [String],
    resolved: { type: Boolean, default: false }
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

clientSatisfactionSchema.index({ agencyWorkspaceId: 1, 'survey.date': -1 });
clientSatisfactionSchema.index({ clientWorkspaceId: 1, 'survey.date': -1 });
clientSatisfactionSchema.index({ 'nps.category': 1, 'survey.date': -1 });

clientSatisfactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Categorize NPS
  if (this.nps.score !== undefined) {
    if (this.nps.score >= 9) {
      this.nps.category = 'promoter';
    } else if (this.nps.score >= 7) {
      this.nps.category = 'passive';
    } else {
      this.nps.category = 'detractor';
    }
  }

  // Calculate overall satisfaction
  if (this.overallSatisfaction.factors) {
    const factors = this.overallSatisfaction.factors;
    const scores = Object.values(factors).filter(s => s !== undefined);
    if (scores.length > 0) {
      this.overallSatisfaction.score = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length
      );
    }
  }

  next();
});

module.exports = mongoose.model('ClientSatisfaction', clientSatisfactionSchema);


