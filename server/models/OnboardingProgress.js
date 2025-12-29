// Onboarding Progress Model

const mongoose = require('mongoose');

const onboardingProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  currentStep: {
    type: Number,
    default: 0,
  },
  completedSteps: [{
    stepId: String,
    completedAt: Date,
  }],
  skipped: {
    type: Boolean,
    default: false,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: Date,
  startedAt: {
    type: Date,
    default: Date.now,
  },
  preferences: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
});

onboardingProgressSchema.index({ userId: 1 });
onboardingProgressSchema.index({ completed: 1 });

module.exports = mongoose.model('OnboardingProgress', onboardingProgressSchema);






