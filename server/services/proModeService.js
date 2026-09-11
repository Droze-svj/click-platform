// Pro Mode Service
// Advanced filters, keyboard shortcuts, power-user configuration

const mongoose = require('mongoose');
const UserPreferences = require('../models/UserPreferences');
const logger = require('../utils/logger');

/**
 * Build the in-memory default preferences shape so Supabase-only users
 * (whose userIds are UUIDs, not Mongo ObjectIds) still get a valid response
 * from every Pro Mode endpoint instead of a 400 CastError.
 */
function buildEphemeralDefaults(userId) {
  return {
    userId,
    proMode: { enabled: false, features: {} },
    advancedFilters: [],
    keyboardShortcuts: [],
    brandKit: {},
    notifications: {},
    preferences: {},
  };
}

function isMongoUserId(userId) {
  return mongoose.Types.ObjectId.isValid(String(userId));
}

/**
 * Get user preferences
 */
async function getUserPreferences(userId) {
  // Now supports any userId string/ObjectId since userId schema is type: Mixed
  try {
    let preferences = await UserPreferences.findOne({ userId }).lean();

    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    return preferences;
  } catch (error) {
    logger.error('Error getting user preferences', { error: error.message, userId });
    throw error;
  }
}

/**
 * Create default preferences
 */
async function createDefaultPreferences(userId) {
  const preferences = new UserPreferences({
    userId,
    proMode: {
      enabled: false,
      features: {
        advancedFilters: false,
        keyboardShortcuts: true,
        bulkOperations: false,
        customWorkflows: false,
        apiAccess: false,
        advancedAnalytics: false
      }
    },
    shortcuts: {
      enabled: true,
      custom: [],
      defaults: {
        search: 'ctrl+k',
        newContent: 'ctrl+n',
        save: 'ctrl+s',
        publish: 'ctrl+p',
        bulkSelect: 'ctrl+shift+a',
        filter: 'ctrl+f',
        export: 'ctrl+e',
        settings: 'ctrl+,'
      }
    },
    filters: {
      saved: [],
      quickFilters: []
    },
    configuration: {
      bulkOperations: {
        maxItems: 100,
        confirmBeforeExecute: true
      },
      workflows: {
        autoSave: true,
        autoSaveInterval: 30,
        showAdvancedOptions: false
      },
      analytics: {
        defaultView: 'dashboard',
        showAdvancedMetrics: false,
        exportFormat: 'csv'
      },
      content: {
        defaultPlatform: null,
        defaultFormat: null,
        autoTag: false,
        showPreview: true
      }
    },
    ui: {
      theme: 'light',
      density: 'comfortable',
      sidebar: {
        collapsed: false,
        position: 'left'
      },
      showTooltips: true,
      showKeyboardHints: true
    }
  });

  await preferences.save();
  return preferences;
}

/**
 * Enable/disable pro mode
 */
async function toggleProMode(userId, enabled) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    preferences.proMode.enabled = enabled;

    // Auto-enable pro features when enabling pro mode
    if (enabled) {
      preferences.proMode.features.advancedFilters = true;
      preferences.proMode.features.bulkOperations = true;
      preferences.proMode.features.customWorkflows = true;
      preferences.proMode.features.advancedAnalytics = true;
    }

    preferences.markModified('proMode');
    await preferences.save();
    return preferences;
  } catch (error) {
    logger.error('Error toggling pro mode', { error: error.message, userId });
    throw error;
  }
}

/**
 * Save advanced filter
 */
async function saveAdvancedFilter(userId, filterData) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    if (!preferences.filters) {
      preferences.filters = { saved: [], quickFilters: [] };
    }
    if (!Array.isArray(preferences.filters.saved)) {
      preferences.filters.saved = [];
    }

    preferences.filters.saved.push({
      name: filterData.name,
      filters: filterData.filters,
      isDefault: filterData.isDefault || false
    });

    // If set as default, unset others
    if (filterData.isDefault) {
      preferences.filters.saved.forEach(f => {
        if (f.name !== filterData.name) {
          f.isDefault = false;
        }
      });
    }

    preferences.markModified('filters');
    await preferences.save();
    return preferences;
  } catch (error) {
    logger.error('Error saving advanced filter', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get advanced filters
 */
async function getAdvancedFilters(userId) {
  try {
    const preferences = await getUserPreferences(userId);
    return {
      saved: preferences.filters?.saved || [],
      quickFilters: preferences.filters?.quickFilters || []
    };
  } catch (error) {
    logger.error('Error getting advanced filters', { error: error.message, userId });
    throw error;
  }
}

/**
 * Save keyboard shortcut
 */
async function saveKeyboardShortcut(userId, shortcutData) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    if (!preferences.shortcuts) {
      preferences.shortcuts = { enabled: true, custom: [], defaults: {} };
    }
    if (!Array.isArray(preferences.shortcuts.custom)) {
      preferences.shortcuts.custom = [];
    }

    // Check if custom shortcut exists
    const existingIndex = preferences.shortcuts.custom.findIndex(
      s => s.key === shortcutData.key
    );

    if (existingIndex >= 0) {
      preferences.shortcuts.custom[existingIndex] = {
        key: shortcutData.key,
        action: shortcutData.action,
        description: shortcutData.description
      };
    } else {
      preferences.shortcuts.custom.push({
        key: shortcutData.key,
        action: shortcutData.action,
        description: shortcutData.description
      });
    }

    preferences.markModified('shortcuts');
    await preferences.save();
    return preferences;
  } catch (error) {
    logger.error('Error saving keyboard shortcut', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get keyboard shortcuts
 */
async function getKeyboardShortcuts(userId) {
  try {
    const preferences = await getUserPreferences(userId);
    return {
      enabled: preferences.shortcuts?.enabled ?? true,
      defaults: preferences.shortcuts?.defaults || {},
      custom: preferences.shortcuts?.custom || []
    };
  } catch (error) {
    logger.error('Error getting keyboard shortcuts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update configuration
 */
async function updateConfiguration(userId, category, config) {
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }

    if (!preferences.configuration) {
      preferences.configuration = {};
    }

    if (category === 'ui') {
      preferences.ui = preferences.ui || {};
      Object.assign(preferences.ui, config);
      preferences.markModified('ui');
    } else {
      if (!preferences.configuration[category]) {
        preferences.configuration[category] = {};
      }
      Object.assign(preferences.configuration[category], config);
      preferences.markModified('configuration');
    }

    await preferences.save();
    return preferences;
  } catch (error) {
    logger.error('Error updating configuration', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get configuration
 */
async function getConfiguration(userId) {
  try {
    const preferences = await getUserPreferences(userId);
    return preferences.configuration;
  } catch (error) {
    logger.error('Error getting configuration', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get brand kit (for video/editor consistency)
 */
async function getBrandKit(userId) {
  try {
    const preferences = await getUserPreferences(userId);
    return preferences.brandKit || {};
  } catch (error) {
    logger.error('Error getting brand kit', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update brand kit
 */
async function updateBrandKit(userId, brandKit) {
  // Brand kit updates are now persisted directly for all users including strings
  try {
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = await createDefaultPreferences(userId);
    }
    if (!preferences.brandKit) {
      preferences.brandKit = {};
    }
    const allowed = [
      'primaryColor', 'accentColor', 'titleFont', 'bodyFont',
      'lowerThirdStyle', 'lowerThirdPosition', 'logoPlacement', 'logoOpacity',
      'captionStyle', 'captionPosition'
    ];
    allowed.forEach((key) => {
      if (brandKit[key] !== undefined) {
        if (key === 'logoOpacity' && brandKit[key] !== null) {
          const n = Number(brandKit[key]);
          preferences.brandKit[key] = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
        } else {
          preferences.brandKit[key] = brandKit[key] === '' ? undefined : brandKit[key];
        }
      }
    });
    preferences.markModified('brandKit');
    await preferences.save();
    return preferences.brandKit;
  } catch (error) {
    logger.error('Error updating brand kit', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getUserPreferences,
  toggleProMode,
  saveAdvancedFilter,
  getAdvancedFilters,
  saveKeyboardShortcut,
  getKeyboardShortcuts,
  updateConfiguration,
  getConfiguration,
  getBrandKit,
  updateBrandKit
};


