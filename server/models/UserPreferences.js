// User Preferences Model
// Pro mode settings and power-user configurations

const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.Mixed, // Supports ObjectId, string UUIDs, and dev-user strings
    ref: 'User',
    required: true,
    unique: true
    // unique: true already creates an index, and there's also a standalone index below
  },
  // Pro mode
  proMode: {
    enabled: { type: Boolean, default: false },
    features: {
      advancedFilters: { type: Boolean, default: false },
      keyboardShortcuts: { type: Boolean, default: true },
      bulkOperations: { type: Boolean, default: false },
      customWorkflows: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false }
    }
  },
  // Keyboard shortcuts
  shortcuts: {
    enabled: { type: Boolean, default: true },
    custom: [{
      key: String, // e.g., 'ctrl+k'
      action: String, // e.g., 'search'
      description: String
    }],
    defaults: {
      search: { type: String, default: 'ctrl+k' },
      newContent: { type: String, default: 'ctrl+n' },
      save: { type: String, default: 'ctrl+s' },
      publish: { type: String, default: 'ctrl+p' },
      bulkSelect: { type: String, default: 'ctrl+shift+a' },
      filter: { type: String, default: 'ctrl+f' },
      export: { type: String, default: 'ctrl+e' },
      settings: { type: String, default: 'ctrl+,' }
    }
  },
  // Advanced filters
  filters: {
    saved: [{
      name: String,
      filters: mongoose.Schema.Types.Mixed,
      isDefault: { type: Boolean, default: false }
    }],
    quickFilters: [{
      name: String,
      filters: mongoose.Schema.Types.Mixed
    }]
  },
  // Advanced configuration
  configuration: {
    bulkOperations: {
      maxItems: { type: Number, default: 100 },
      confirmBeforeExecute: { type: Boolean, default: true }
    },
    workflows: {
      autoSave: { type: Boolean, default: true },
      autoSaveInterval: { type: Number, default: 30 }, // seconds
      showAdvancedOptions: { type: Boolean, default: false }
    },
    analytics: {
      defaultView: { type: String, default: 'dashboard' },
      showAdvancedMetrics: { type: Boolean, default: false },
      exportFormat: { type: String, default: 'csv' }
    },
    content: {
      defaultPlatform: String,
      defaultFormat: String,
      autoTag: { type: Boolean, default: false },
      showPreview: { type: Boolean, default: true }
    }
  },
  // UI preferences
  ui: {
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
    density: { type: String, enum: ['comfortable', 'compact', 'spacious'], default: 'comfortable' },
    sidebar: {
      collapsed: { type: Boolean, default: false },
      position: { type: String, enum: ['left', 'right'], default: 'left' }
    },
    showTooltips: { type: Boolean, default: true },
    showKeyboardHints: { type: Boolean, default: true }
  },
  // Manual editing presets
  presets: [{
    id: String,
    name: String,
    category: String,
    settings: mongoose.Schema.Types.Mixed,
    thumbnail: String,
    createdAt: Date,
    updatedAt: Date,
    usageCount: { type: Number, default: 0 },
    isPublic: { type: Boolean, default: false }
  }],
  // Edit analytics
  editAnalytics: {
    sessions: [{
      id: String,
      startedAt: Date,
      endedAt: Date,
      featuresUsed: [String],
      renderTime: Number,
      exportTime: Number,
      errors: [String]
    }],
    featureUsage: mongoose.Schema.Types.Mixed,
    cacheHitRate: { type: Number, default: 0 }
  },
  // Brand kit: lock in colors, fonts, lower-third style, logo placement, caption style
  brandKit: {
    primaryColor: { type: String, default: '' },
    accentColor: { type: String, default: '' },
    titleFont: { type: String, default: '' },
    bodyFont: { type: String, default: '' },
    lowerThirdStyle: { type: String, enum: ['bar', 'pill', 'minimal', 'none', ''], default: '' },
    lowerThirdPosition: { type: String, enum: ['left', 'right', 'center', ''], default: '' },
    logoPlacement: { type: String, enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'none', ''], default: '' },
    logoOpacity: { type: Number, default: null },
    captionStyle: { type: String, default: '' },
    captionPosition: { type: String, enum: ['bottom-center', 'lower-third', 'top-center', 'full-width-bottom', ''], default: '' },
  },
  // V6 Autonomous Marketing Intelligence & Continuous Learning
  marketingIntelligence: {
    niche: { type: String, default: 'General' },
    // Captured at signup (2-step personalization). `goals` is the creator's
    // primary objective(s); `platformFocus` is where they publish. Both feed
    // the marketing brain so generations are tuned from the very first session.
    // Stored as plain string arrays (whitelisted at the API boundary) to stay
    // flexible as the catalogue grows.
    goals: { type: [String], default: [] },
    platformFocus: { type: [String], default: [] },
    historicalPerformanceMetrics: {
      avgRetentionRate: { type: Number, default: 0 },
      topPerformingHooks: [String],
      audienceDemographic: String,
      clickThroughRate: { type: Number, default: 0 },
      // Populated by the continuous-learning loop from the creator's
      // UserStyleProfile weighted-performance signal. `avgRetentionDelta` is
      // the EMA retention delta vs. niche benchmark in [-1,1]; `sampleSize`
      // is the total weighted-signal count; `hasRealData` flags whether the
      // last sync had real performance history (vs. a cold-start blueprint).
      avgRetentionDelta: { type: Number, default: 0 },
      sampleSize: { type: Number, default: 0 },
      hasRealData: { type: Boolean, default: false }
    },
    activeCreativeBlueprint: { type: mongoose.Schema.Types.Mixed, default: {} },
    competitorWatchlist: [String],
    lastLearningSync: Date
  },
  // Downloaded templates
  downloadedTemplates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  }],
  // Completed tutorials
  completedTutorials: [String],
  // Synced devices
  syncedDevices: [String],
  // Default AI Video Editing preferences
  videoEditing: {
    preferredVoiceTone: { type: String, default: 'Hype' },
    preferredHookStyle: { type: String, default: 'curiosity-gap' },
    pacingIntensity: { type: String, enum: ['gentle', 'medium', 'aggressive'], default: 'medium' },
    captionStyle: { type: String, default: 'modern' },
    captionFontScale: { type: Number, default: 1.0 },
    captionVerticalOffset: { type: Number, default: 0 },
    aestheticColorGrade: { type: String, default: 'vibrant' },
    aestheticTransition: { type: String, default: 'fade' },
    // Creator voice controls — woven into every AI generation via
    // personalizationService → getClickPersonalityRules (signature vocab) and
    // the banned-clichés list. Empty by default (no effect until the creator sets them).
    brandVocab: { type: [String], default: [] },
    bannedWords: { type: [String], default: [] }
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { suppressReservedKeysWarning: true }); // 'errors' in editAnalytics.sessions is intentional

// userId already has unique: true which creates an index
userPreferencesSchema.index({ 'proMode.enabled': 1 });

userPreferencesSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);


