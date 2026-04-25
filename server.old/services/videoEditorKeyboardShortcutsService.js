// Video Editor Keyboard Shortcuts Service
// Comprehensive keyboard shortcut system for video editing

const logger = require('../utils/logger');
const UserPreferences = require('../models/UserPreferences');

/**
 * Get keyboard shortcuts for video editor
 */
async function getVideoEditorShortcuts(userId) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    const defaultShortcuts = {
      // Playback
      'space': { action: 'play-pause', description: 'Play/Pause', category: 'playback' },
      'j': { action: 'rewind', description: 'Rewind', category: 'playback' },
      'k': { action: 'play', description: 'Play', category: 'playback' },
      'l': { action: 'forward', description: 'Fast Forward', category: 'playback' },
      'arrowleft': { action: 'seek-backward-1', description: 'Seek Backward 1s', category: 'playback' },
      'arrowright': { action: 'seek-forward-1', description: 'Seek Forward 1s', category: 'playback' },
      'shift+arrowleft': { action: 'seek-backward-5', description: 'Seek Backward 5s', category: 'playback' },
      'shift+arrowright': { action: 'seek-forward-5', description: 'Seek Forward 5s', category: 'playback' },
      
      // Editing
      'ctrl+z': { action: 'undo', description: 'Undo', category: 'editing' },
      'ctrl+shift+z': { action: 'redo', description: 'Redo', category: 'editing' },
      'ctrl+c': { action: 'copy', description: 'Copy', category: 'editing' },
      'ctrl+v': { action: 'paste', description: 'Paste', category: 'editing' },
      'ctrl+x': { action: 'cut', description: 'Cut', category: 'editing' },
      'delete': { action: 'delete', description: 'Delete', category: 'editing' },
      's': { action: 'split', description: 'Split Clip', category: 'editing' },
      'ctrl+a': { action: 'select-all', description: 'Select All', category: 'editing' },
      
      // Timeline
      'i': { action: 'set-in-point', description: 'Set In Point', category: 'timeline' },
      'o': { action: 'set-out-point', description: 'Set Out Point', category: 'timeline' },
      'm': { action: 'add-marker', description: 'Add Marker', category: 'timeline' },
      'home': { action: 'go-to-start', description: 'Go to Start', category: 'timeline' },
      'end': { action: 'go-to-end', description: 'Go to End', category: 'timeline' },
      
      // Effects
      'ctrl+e': { action: 'open-effects', description: 'Open Effects Panel', category: 'effects' },
      'ctrl+f': { action: 'apply-filter', description: 'Apply Filter', category: 'effects' },
      'ctrl+t': { action: 'add-text', description: 'Add Text', category: 'effects' },
      'ctrl+m': { action: 'add-music', description: 'Add Music', category: 'effects' },
      
      // Color
      'ctrl+shift+c': { action: 'open-color-grading', description: 'Open Color Grading', category: 'color' },
      'ctrl+shift+a': { action: 'open-audio', description: 'Open Audio Panel', category: 'audio' },
      
      // Export
      'ctrl+shift+e': { action: 'export', description: 'Export Video', category: 'export' },
      'ctrl+s': { action: 'save-project', description: 'Save Project', category: 'project' },
      
      // Navigation
      'ctrl+/': { action: 'show-shortcuts', description: 'Show Shortcuts', category: 'help' },
      'escape': { action: 'close-panel', description: 'Close Panel', category: 'navigation' },
      'tab': { action: 'toggle-panels', description: 'Toggle Panels', category: 'navigation' },
    };

    // Merge with user custom shortcuts
    const userShortcuts = preferences?.shortcuts?.custom || [];
    const mergedShortcuts = { ...defaultShortcuts };
    
    userShortcuts.forEach(custom => {
      mergedShortcuts[custom.key] = {
        action: custom.action,
        description: custom.description || custom.action,
        category: custom.category || 'custom'
      };
    });

    return {
      shortcuts: mergedShortcuts,
      enabled: preferences?.shortcuts?.enabled !== false
    };
  } catch (error) {
    logger.error('Get video editor shortcuts error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Save custom keyboard shortcut
 */
async function saveCustomShortcut(userId, shortcut) {
  try {
    const { key, action, description, category } = shortcut;
    
    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId, shortcuts: { enabled: true, custom: [] } });
    }

    if (!preferences.shortcuts) {
      preferences.shortcuts = { enabled: true, custom: [] };
    }

    if (!preferences.shortcuts.custom) {
      preferences.shortcuts.custom = [];
    }

    // Remove existing shortcut with same key
    preferences.shortcuts.custom = preferences.shortcuts.custom.filter(s => s.key !== key);
    
    // Add new shortcut
    preferences.shortcuts.custom.push({ key, action, description, category });
    
    await preferences.save();

    logger.info('Custom shortcut saved', { userId, key, action });
    return { success: true };
  } catch (error) {
    logger.error('Save custom shortcut error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get shortcut presets (Premiere, Final Cut, DaVinci)
 */
function getShortcutPresets() {
  return {
    'premiere': {
      name: 'Adobe Premiere Pro',
      shortcuts: {
        'space': { action: 'play-pause', description: 'Play/Pause' },
        'j': { action: 'rewind', description: 'Rewind' },
        'k': { action: 'play', description: 'Play' },
        'l': { action: 'forward', description: 'Fast Forward' },
        'ctrl+z': { action: 'undo', description: 'Undo' },
        'ctrl+shift+z': { action: 'redo', description: 'Redo' },
        's': { action: 'split', description: 'Razor Tool' },
        'i': { action: 'set-in-point', description: 'Set In Point' },
        'o': { action: 'set-out-point', description: 'Set Out Point' },
      }
    },
    'final-cut': {
      name: 'Final Cut Pro',
      shortcuts: {
        'space': { action: 'play-pause', description: 'Play/Pause' },
        'j': { action: 'rewind', description: 'Rewind' },
        'k': { action: 'play', description: 'Play' },
        'l': { action: 'forward', description: 'Fast Forward' },
        'cmd+z': { action: 'undo', description: 'Undo' },
        'cmd+shift+z': { action: 'redo', description: 'Redo' },
        'b': { action: 'split', description: 'Blade Tool' },
        'i': { action: 'set-in-point', description: 'Set In Point' },
        'o': { action: 'set-out-point', description: 'Set Out Point' },
      }
    },
    'davinci': {
      name: 'DaVinci Resolve',
      shortcuts: {
        'space': { action: 'play-pause', description: 'Play/Pause' },
        'j': { action: 'rewind', description: 'Rewind' },
        'k': { action: 'play', description: 'Play' },
        'l': { action: 'forward', description: 'Fast Forward' },
        'ctrl+z': { action: 'undo', description: 'Undo' },
        'ctrl+y': { action: 'redo', description: 'Redo' },
        'ctrl+b': { action: 'split', description: 'Split Clip' },
        'i': { action: 'set-in-point', description: 'Set In Point' },
        'o': { action: 'set-out-point', description: 'Set Out Point' },
      }
    }
  };
}

/**
 * Apply shortcut preset
 */
async function applyShortcutPreset(userId, presetName) {
  try {
    const presets = getShortcutPresets();
    const preset = presets[presetName];
    
    if (!preset) {
      throw new Error(`Preset "${presetName}" not found`);
    }

    let preferences = await UserPreferences.findOne({ userId });
    if (!preferences) {
      preferences = new UserPreferences({ userId });
    }

    if (!preferences.shortcuts) {
      preferences.shortcuts = { enabled: true, custom: [] };
    }

    // Convert preset shortcuts to custom format
    preferences.shortcuts.custom = Object.entries(preset.shortcuts).map(([key, value]) => ({
      key,
      action: value.action,
      description: value.description,
      category: 'preset'
    }));

    await preferences.save();

    logger.info('Shortcut preset applied', { userId, preset: presetName });
    return { success: true, preset: presetName };
  } catch (error) {
    logger.error('Apply shortcut preset error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getVideoEditorShortcuts,
  saveCustomShortcut,
  getShortcutPresets,
  applyShortcutPreset,
};
