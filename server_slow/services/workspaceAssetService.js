// Workspace Asset Service
// Manage assets, guidelines, and workflows per workspace with strict isolation

const Workspace = require('../models/Workspace');
const Content = require('../models/Content');
const ClientGuidelines = require('../models/ClientGuidelines');
const ApprovalWorkflow = require('../models/ApprovalWorkflow');
const ContentTemplate = require('../models/ContentTemplate');
const logger = require('../utils/logger');

/**
 * Get all assets for a workspace (strictly isolated)
 */
async function getWorkspaceAssets(workspaceId, assetType = null) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const query = { workspaceId };
    if (assetType) {
      query.type = assetType;
    }

    const assets = await Content.find(query)
      .select('title type mediaUrl tags createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return assets;
  } catch (error) {
    logger.error('Error getting workspace assets', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get workspace guidelines
 */
async function getWorkspaceGuidelines(workspaceId) {
  try {
    const guidelines = await ClientGuidelines.findOne({ workspaceId }).lean();
    return guidelines;
  } catch (error) {
    logger.error('Error getting workspace guidelines', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get workspace workflows
 */
async function getWorkspaceWorkflows(workspaceId) {
  try {
    // Get workflows that belong to this workspace
    const workflows = await ApprovalWorkflow.find({
      workspaceId,
      isActive: true
    }).lean();

    return workflows;
  } catch (error) {
    logger.error('Error getting workspace workflows', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get workspace templates
 */
async function getWorkspaceTemplates(workspaceId) {
  try {
    const templates = await ContentTemplate.find({
      workspaceId,
      isActive: true
    }).lean();

    return templates;
  } catch (error) {
    logger.error('Error getting workspace templates', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Verify asset belongs to workspace
 */
async function verifyAssetOwnership(assetId, workspaceId) {
  try {
    const asset = await Content.findOne({
      _id: assetId,
      workspaceId
    });

    return !!asset;
  } catch (error) {
    logger.error('Error verifying asset ownership', { error: error.message, assetId, workspaceId });
    return false;
  }
}

/**
 * Get workspace summary (assets, guidelines, workflows count)
 */
async function getWorkspaceSummary(workspaceId) {
  try {
    const [assets, guidelines, workflows, templates] = await Promise.all([
      Content.countDocuments({ workspaceId }),
      ClientGuidelines.countDocuments({ workspaceId }),
      ApprovalWorkflow.countDocuments({ workspaceId, isActive: true }),
      ContentTemplate.countDocuments({ workspaceId, isActive: true })
    ]);

    return {
      assets,
      guidelines: guidelines > 0,
      workflows,
      templates
    };
  } catch (error) {
    logger.error('Error getting workspace summary', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  getWorkspaceAssets,
  getWorkspaceGuidelines,
  getWorkspaceWorkflows,
  getWorkspaceTemplates,
  verifyAssetOwnership,
  getWorkspaceSummary
};


