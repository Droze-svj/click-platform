// Workspace Scene Settings Service

const WorkspaceSceneSettings = require('../models/WorkspaceSceneSettings');
const logger = require('../utils/logger');

/**
 * Get workspace scene settings (create defaults if not exist)
 */
async function getWorkspaceSettings(workspaceId) {
  try {
    let settings = await WorkspaceSceneSettings.findOne({ workspaceId });

    if (!settings) {
      // Create default settings
      settings = await WorkspaceSceneSettings.create({
        workspaceId
      });
      logger.info('Created default workspace scene settings', { workspaceId });
    }

    return settings;
  } catch (error) {
    logger.error('Error getting workspace scene settings', { workspaceId, error: error.message });
    throw error;
  }
}

/**
 * Update workspace scene settings
 */
async function updateWorkspaceSettings(workspaceId, updates) {
  try {
    const settings = await WorkspaceSceneSettings.findOneAndUpdate(
      { workspaceId },
      { $set: updates },
      { new: true, upsert: true }
    );

    logger.info('Workspace scene settings updated', { workspaceId, updates });
    return settings;
  } catch (error) {
    logger.error('Error updating workspace scene settings', { workspaceId, error: error.message });
    throw error;
  }
}

/**
 * Apply workspace settings to detection options
 */
function applyWorkspaceSettings(options, workspaceSettings) {
  if (!workspaceSettings) {
    return options;
  }

  const applied = { ...options };

  // Apply defaults if not explicitly provided
  if (applied.sensitivity === undefined) {
    applied.sensitivity = workspaceSettings.defaultSensitivity;
  }

  if (applied.minSceneLength === undefined) {
    applied.minSceneLength = workspaceSettings.defaultMinSceneLength;
  }

  if (applied.maxSceneLength === undefined) {
    applied.maxSceneLength = workspaceSettings.defaultMaxSceneLength;
  }

  if (applied.workflowType === undefined) {
    applied.workflowType = workspaceSettings.defaultWorkflowType;
  }

  // Apply feature flags
  if (workspaceSettings.disableHeavyAIAnalysis) {
    applied.useMultiModal = false;
    applied.enableAdvancedAudioAnalysis = false;
  } else {
    if (applied.useMultiModal === undefined) {
      applied.useMultiModal = workspaceSettings.enableMultiModal;
    }
  }

  // Language setting
  if (workspaceSettings.transcriptLanguage) {
    applied.transcriptLanguage = workspaceSettings.transcriptLanguage;
  }

  return applied;
}

module.exports = {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  applyWorkspaceSettings
};







