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
  // Appearance / display preferences (2026 settings overhaul)
  appearance: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    density: { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
    reducedMotion: { type: Boolean, default: false },
    accent: { type: String, default: '' }
  },
  // User-level AI provider preference (2026 settings overhaul)
  ai: {
    provider: { type: String, enum: ['auto', 'claude', 'gemini'], default: 'auto' },
    creativity: { type: Number, default: 0.5 }, // 0..1
    autoApply: { type: Boolean, default: false }
  },
  // Third-party integration API keys. The raw key is NEVER stored in plaintext
  // and NEVER returned to the client — only last4/label/provider are surfaced.
  // keyCiphertext holds the AES-256-GCM payload from utils/dataEncryption.
  integrations: [{
    provider: { type: String, required: true },
    label: { type: String, default: '' },
    keyCiphertext: { type: mongoose.Schema.Types.Mixed }, // { encrypted, iv, tag }
    last4: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  // Default AI Video Editing preferences
  videoEditing: {
    preferredVoiceTone: { type: String, default: 'Hype' },
    preferredHookStyle: { type: String, default: 'curiosity-gap' },
    pacingIntensity: { type: String, default: 'medium' },
    captionStyle: { type: String, default: 'modern' },
    captionFontScale: { type: Number, default: 1.0 },
    captionVerticalOffset: { type: Number, default: 0 },
    aestheticColorGrade: { type: String, default: 'vibrant' },
    aestheticTransition: { type: String, default: 'fade' },
    subtitlePosition: { type: String, enum: ['auto', 'top', 'middle', 'bottom', 'lower-third'], default: 'auto' },
    contentTone: { type: String, enum: ['auto', 'educational', 'entertaining', 'motivational', 'promotional'], default: 'auto' },
    brollFrequency: { type: String, enum: ['off', 'minimal', 'balanced', 'heavy'], default: 'balanced' },
    musicGenre: { type: String, default: 'auto' },
    defaultPlatform: { type: String, enum: ['auto', 'tiktok', 'instagram', 'youtube', 'linkedin'], default: 'auto' },
    enableSpeedRamping: { type: Boolean, default: true },
    enableBRoll: { type: Boolean, default: true },
  },
  updatedAt: { type: Date, default: Date.now }
}, {});

userSettingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserSettings', userSettingsSchema);
