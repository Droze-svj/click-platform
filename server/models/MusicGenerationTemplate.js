// Music Generation Template Model
// Pre-configured generation presets

const mongoose = require('mongoose');

const musicGenerationTemplateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  name: {
    type: String,
    required: true
  },
  description: String,
  provider: {
    type: String,
    enum: ['mubert', 'soundraw'],
    required: true
  },
  // Generation parameters
  params: {
    mood: String,
    genre: String,
    duration: {
      type: Number,
      default: 60
    },
    bpm: Number,
    intensity: String,
    tempo: String
  },
  // Use case tags
  useCases: [{
    type: String,
    enum: ['intro', 'outro', 'background', 'transition', 'highlight', 'scene', 'vlog', 'tutorial', 'promo', 'other']
  }],
  tags: [String],
  isPublic: {
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

musicGenerationTemplateSchema.index({ userId: 1, createdAt: -1 });
musicGenerationTemplateSchema.index({ isPublic: 1 });
musicGenerationTemplateSchema.index({ useCases: 1 });

musicGenerationTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MusicGenerationTemplate', musicGenerationTemplateSchema);







