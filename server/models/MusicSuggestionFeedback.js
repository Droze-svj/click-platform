// Music Suggestion Feedback Model
// Tracks user interactions with suggestions to improve recommendations

const mongoose = require('mongoose');

const musicSuggestionFeedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Content',
    required: true,
    index: true
  },
  suggestionId: {
    type: String,
    required: true
  },
  suggestionSource: {
    type: String,
    enum: ['licensed', 'ai_generated'],
    required: true
  },
  // User action
  action: {
    type: String,
    enum: ['selected', 'previewed', 'dismissed', 'generated'],
    required: true
  },
  // Video analysis context
  videoContext: {
    mood: String,
    energyLevel: Number,
    videoType: String,
    platform: String,
    category: String
  },
  // Suggestion details
  suggestionDetails: {
    mood: String,
    genre: String,
    bpm: Number,
    duration: Number
  },
  // Outcome
  outcome: {
    type: String,
    enum: ['used_in_final', 'replaced', 'not_used'],
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

musicSuggestionFeedbackSchema.index({ userId: 1, timestamp: -1 });
musicSuggestionFeedbackSchema.index({ contentId: 1 });
musicSuggestionFeedbackSchema.index({ action: 1, timestamp: -1 });

module.exports = mongoose.model('MusicSuggestionFeedback', musicSuggestionFeedbackSchema);







