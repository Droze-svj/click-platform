const mongoose = require('mongoose');

const suggestionFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    suggestionId: { type: String, default: null },
    facet: {
      type: String,
      enum: ['transition', 'caption', 'pacing', 'overlay', 'music', 'cut', 'other'],
      required: true,
    },
    key: { type: String, required: true },
    signal: {
      type: String,
      enum: ['positive', 'negative', 'dismiss'],
      required: true,
    },
    segmentId: { type: String, default: null },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      default: null,
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

suggestionFeedbackSchema.index({ userId: 1, facet: 1, signal: 1 });
suggestionFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports =
  mongoose.models.SuggestionFeedback ||
  mongoose.model('SuggestionFeedback', suggestionFeedbackSchema);
