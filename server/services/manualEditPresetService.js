// Manual Edit Preset Management Service
// Save, load, and manage custom presets for manual editing

const logger = require('../utils/logger');
const UserPreferences = require('../models/UserPreferences');
const fs = require('fs');
const path = require('path');

/**
 * Save custom preset
 */
async function savePreset(userId, presetData) {
  try {
    const { name, category, settings, thumbnail } = presetData;

    if (!name || !category || !settings) {
      throw new Error('Preset name, category, and settings are required');
    }

    let preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences) {
      preferences = new UserPreferences({ userId, presets: [] });
    }

    if (!preferences.presets) {
      preferences.presets = [];
    }

    // Check if preset with same name exists
    const existingIndex = preferences.presets.findIndex(
      p => p.name === name && p.category === category
    );

    const preset = {
      id: existingIndex >= 0 ? preferences.presets[existingIndex].id : `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      category,
      settings,
      thumbnail,
      createdAt: existingIndex >= 0 ? preferences.presets[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: existingIndex >= 0 ? (preferences.presets[existingIndex].usageCount || 0) : 0
    };

    if (existingIndex >= 0) {
      preferences.presets[existingIndex] = preset;
    } else {
      preferences.presets.push(preset);
    }

    await preferences.save();

    logger.info('Preset saved', { userId, presetId: preset.id, category });
    return {
      success: true,
      preset: preset
    };
  } catch (error) {
    logger.error('Save preset error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get user presets
 */
async function getUserPresets(userId, category = null) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences || !preferences.presets) {
      return { presets: [] };
    }

    let presets = preferences.presets;
    
    if (category) {
      presets = presets.filter(p => p.category === category);
    }

    // Sort by usage count and updated date
    presets.sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return { presets };
  } catch (error) {
    logger.error('Get user presets error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get preset by ID
 */
async function getPreset(userId, presetId) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences || !preferences.presets) {
      throw new Error('Preset not found');
    }

    const preset = preferences.presets.find(p => p.id === presetId);
    
    if (!preset) {
      throw new Error('Preset not found');
    }

    // Increment usage count
    preset.usageCount = (preset.usageCount || 0) + 1;
    preset.updatedAt = new Date().toISOString();
    await preferences.save();

    return { preset };
  } catch (error) {
    logger.error('Get preset error', { error: error.message, userId, presetId });
    throw error;
  }
}

/**
 * Delete preset
 */
async function deletePreset(userId, presetId) {
  try {
    const preferences = await UserPreferences.findOne({ userId });
    
    if (!preferences || !preferences.presets) {
      throw new Error('Preset not found');
    }

    const initialLength = preferences.presets.length;
    preferences.presets = preferences.presets.filter(p => p.id !== presetId);
    
    if (preferences.presets.length === initialLength) {
      throw new Error('Preset not found');
    }

    await preferences.save();

    logger.info('Preset deleted', { userId, presetId });
    return { success: true };
  } catch (error) {
    logger.error('Delete preset error', { error: error.message, userId, presetId });
    throw error;
  }
}

/**
 * Get preset categories
 */
function getPresetCategories() {
  return [
    'color-grading',
    'audio-mixing',
    'typography',
    'motion-graphics',
    'transitions',
    'speed-control',
    'export-settings',
    'custom'
  ];
}

/**
 * Get community presets (public presets from all users)
 */
async function getCommunityPresets(category = null, limit = 20) {
  try {
    // Get presets from users who have made them public
    const preferences = await UserPreferences.find({
      'presets.isPublic': true
    }).limit(100);

    let allPresets = [];
    
    preferences.forEach(pref => {
      if (pref.presets) {
        const publicPresets = pref.presets
          .filter(p => p.isPublic)
          .map(p => ({
            ...p,
            userId: pref.userId
          }));
        allPresets = allPresets.concat(publicPresets);
      }
    });

    if (category) {
      allPresets = allPresets.filter(p => p.category === category);
    }

    // Sort by usage count
    allPresets.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));

    return { presets: allPresets.slice(0, limit) };
  } catch (error) {
    logger.error('Get community presets error', { error: error.message });
    return { presets: [] };
  }
}

module.exports = {
  savePreset,
  getUserPresets,
  getPreset,
  deletePreset,
  getPresetCategories,
  getCommunityPresets,
};
