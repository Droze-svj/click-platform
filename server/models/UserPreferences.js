// User Preferences Model
// Pro mode settings and power-user configurations

const mongoose = require('mongoose');

const userPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
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
  // Downloaded templates
  downloadedTemplates: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Template'
  }],
  // Completed tutorials
  completedTutorials: [String],
  // Synced devices
  syncedDevices: [String],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { suppressReservedKeysWarning: true }); // 'errors' in editAnalytics.sessions is intentional

// userId already has unique: true which creates an index
userPreferencesSchema.index({ 'proMode.enabled': 1 });

userPreferencesSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('UserPreferences', userPreferencesSchema);


