// User settings for /api/user/settings (notifications, privacy, preferences).
// Keyed by string userId (Supabase UUID or dev id) for compatibility.

const mongoose = require('mongoose');

const userSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    contentReady: { type: Boolean, default: true },
    weeklyDigest: { type: Boolean, default: false },
    achievements: { type: Boolean, default: true },
    mentions: { type: Boolean, default: true },
    comments: { type: Boolean, default: false },
    priorityTiers: { type: String, enum: ['high_only', 'high_medium', 'all'], default: 'all' },
    digestMode: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' },
    digestTime: { type: String, default: '09:00' },
    channels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true }
    },
    categories: {
      task: { type: Boolean, default: true },
      project: { type: Boolean, default: true },
      content: { type: Boolean, default: true },
      approval: { type: Boolean, default: true },
      mention: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
      workflow: { type: Boolean, default: true }
    }
  },
  privacy: {
    dataConsent: { type: Boolean, default: true },
    marketingConsent: { type: Boolean, default: false },
    analyticsConsent: { type: Boolean, default: true }
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: '' },
    lastUsedWorkflowTemplateId: { type: String, default: '' }
  },
  agentic: {
    autonomousSwarm: { type: Boolean, default: true },
    slaAutoFulfill: { type: Boolean, default: true },
    predictiveThreshold: { type: Number, default: 85 },
    digitalTwinProvider: { type: String, enum: ['heygen', 'sora', 'both'], default: 'both' },
    heygenApiKey: { type: String, default: '' },
    soraApiKey: { type: String, default: '' }
  },
  updatedAt: { type: Date, default: Date.now }
}, { strict: true });

userSettingsSchema.index({ userId: 1 });
userSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);
