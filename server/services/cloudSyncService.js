// Cloud Sync & Backup Service
// Auto-save to cloud, project sync across devices, version history

const logger = require('../utils/logger');
const Content = require('../models/Content');
const { uploadFile } = require('./storageService');
const fs = require('fs');
const path = require('path');

/**
 * Save project to cloud
 */
async function saveProjectToCloud(videoId, projectData) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata) {
      content.metadata = {};
    }

    // Save project state
    content.metadata.cloudSync = {
      projectData,
      syncedAt: new Date().toISOString(),
      version: (content.metadata.cloudSync?.version || 0) + 1
    };

    // Save version history
    if (!content.metadata.versionHistory) {
      content.metadata.versionHistory = [];
    }

    content.metadata.versionHistory.push({
      version: content.metadata.cloudSync.version,
      projectData,
      syncedAt: new Date().toISOString()
    });

    // Limit version history to last 50 versions
    if (content.metadata.versionHistory.length > 50) {
      content.metadata.versionHistory.shift();
    }

    await content.save();

    logger.info('Project saved to cloud', { videoId, version: content.metadata.cloudSync.version });
    return {
      success: true,
      version: content.metadata.cloudSync.version,
      syncedAt: content.metadata.cloudSync.syncedAt
    };
  } catch (error) {
    logger.error('Save project to cloud error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get project from cloud
 */
async function getProjectFromCloud(videoId, version = null) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata?.cloudSync) {
      return { success: false, message: 'No cloud sync data available' };
    }

    if (version) {
      // Get specific version
      const versionData = content.metadata.versionHistory?.find(v => v.version === version);
      if (!versionData) {
        throw new Error(`Version ${version} not found`);
      }
      return {
        success: true,
        projectData: versionData.projectData,
        version: versionData.version,
        syncedAt: versionData.syncedAt
      };
    }

    // Get latest version
    return {
      success: true,
      projectData: content.metadata.cloudSync.projectData,
      version: content.metadata.cloudSync.version,
      syncedAt: content.metadata.cloudSync.syncedAt
    };
  } catch (error) {
    logger.error('Get project from cloud error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Get version history
 */
async function getVersionHistory(videoId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    const history = content.metadata?.versionHistory || [];
    
    return {
      versions: history.map(v => ({
        version: v.version,
        syncedAt: v.syncedAt,
        preview: v.projectData?.name || `Version ${v.version}`
      })),
      currentVersion: content.metadata?.cloudSync?.version || 0
    };
  } catch (error) {
    logger.error('Get version history error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Restore project version
 */
async function restoreProjectVersion(videoId, version) {
  try {
    const project = await getProjectFromCloud(videoId, version);
    
    if (!project.success) {
      throw new Error('Failed to get project version');
    }

    // Save as new version
    await saveProjectToCloud(videoId, project.projectData);

    logger.info('Project version restored', { videoId, version });
    return { success: true, restoredVersion: version };
  } catch (error) {
    logger.error('Restore project version error', { error: error.message, videoId });
    throw error;
  }
}

/**
 * Sync project across devices
 */
async function syncProjectAcrossDevices(videoId, deviceId) {
  try {
    const content = await Content.findById(videoId);
    if (!content) {
      throw new Error('Content not found');
    }

    if (!content.metadata) {
      content.metadata = {};
    }

    if (!content.metadata.syncedDevices) {
      content.metadata.syncedDevices = [];
    }

    // Add device if not already synced
    if (!content.metadata.syncedDevices.includes(deviceId)) {
      content.metadata.syncedDevices.push(deviceId);
      await content.save();
    }

    logger.info('Project synced across devices', { videoId, deviceId });
    return {
      success: true,
      syncedDevices: content.metadata.syncedDevices,
      lastSync: content.metadata.cloudSync?.syncedAt
    };
  } catch (error) {
    logger.error('Sync project across devices error', { error: error.message, videoId });
    throw error;
  }
}

module.exports = {
  saveProjectToCloud,
  getProjectFromCloud,
  getVersionHistory,
  restoreProjectVersion,
  syncProjectAcrossDevices,
};
