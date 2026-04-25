// Playbook Service
// Manage cross-client templates and playbooks

const Playbook = require('../models/Playbook');
const Content = require('../models/Content');
const logger = require('../utils/logger');

/**
 * Create playbook
 */
async function createPlaybook(userId, playbookData) {
  try {
    const playbook = new Playbook({
      userId,
      name: playbookData.name,
      description: playbookData.description,
      category: playbookData.category || 'other',
      structure: playbookData.structure || { steps: [], estimatedTotalTime: 0, deliverables: [] },
      contentTemplates: playbookData.contentTemplates || [],
      scheduling: playbookData.scheduling || {},
      approval: playbookData.approval || { required: true, autoApprove: false },
      successCriteria: playbookData.successCriteria || {},
      sharing: playbookData.sharing || { isPublic: false, sharedWith: [] },
      tags: playbookData.tags || []
    });

    await playbook.save();
    return playbook;
  } catch (error) {
    logger.error('Error creating playbook', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get playbooks
 */
async function getPlaybooks(userId, filters = {}) {
  try {
    const {
      category = null,
      includeShared = true,
      includePublic = true
    } = filters;

    const query = {
      $or: [
        { userId },
        ...(includeShared ? [{ 'sharing.sharedWith.userId': userId }] : []),
        ...(includePublic ? [{ 'sharing.isPublic': true }] : [])
      ],
      isActive: true
    };

    if (category) {
      query.category = category;
    }

    const playbooks = await Playbook.find(query)
      .populate('sharing.sharedWith.userId', 'name email')
      .sort({ 'stats.timesUsed': -1, createdAt: -1 })
      .lean();

    return playbooks;
  } catch (error) {
    logger.error('Error getting playbooks', { error: error.message, userId });
    throw error;
  }
}

/**
 * Apply playbook to client
 */
async function applyPlaybookToClient(playbookId, userId, clientId, customizations = {}) {
  try {
    const playbook = await Playbook.findById(playbookId).lean();
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    // Check permissions
    if (playbook.userId.toString() !== userId.toString() && 
        !playbook.sharing.sharedWith.some(s => s.userId.toString() === userId.toString()) &&
        !playbook.sharing.isPublic) {
      throw new Error('No permission to use this playbook');
    }

    // Apply content templates
    const createdContent = [];
    for (const template of playbook.contentTemplates) {
      try {
        // Customize template with client-specific data
        const customizedTemplate = customizeTemplate(template, customizations);
        
        // Create content from template
        const content = await createContentFromTemplate(userId, clientId, customizedTemplate);
        createdContent.push(content);
      } catch (error) {
        logger.error('Error creating content from template', { 
          error: error.message, 
          template: template.name 
        });
      }
    }

    // Update playbook stats
    await Playbook.findByIdAndUpdate(playbookId, {
      $inc: { 
        'stats.timesUsed': 1,
        'stats.clientsUsed': playbook.stats.clientsUsed === 0 ? 1 : 0 // Only increment if first use
      },
      $set: { 'stats.clientsUsed': playbook.stats.clientsUsed + 1 }
    });

    return {
      playbook: {
        id: playbook._id,
        name: playbook.name
      },
      clientId,
      createdContent: createdContent.length,
      content: createdContent
    };
  } catch (error) {
    logger.error('Error applying playbook', { error: error.message, playbookId, clientId });
    throw error;
  }
}

/**
 * Customize template
 */
function customizeTemplate(template, customizations) {
  const customized = { ...template };

  // Replace placeholders
  if (customizations.clientName) {
    customized.template.caption = customized.template.caption?.replace(/\{clientName\}/g, customizations.clientName);
  }

  if (customizations.productName) {
    customized.template.caption = customized.template.caption?.replace(/\{productName\}/g, customizations.productName);
  }

  if (customizations.hashtags && customized.template.hashtags) {
    customized.template.hashtags = [...customized.template.hashtags, ...customizations.hashtags];
  }

  return customized;
}

/**
 * Create content from template
 */
async function createContentFromTemplate(userId, clientId, template) {
  try {
    const content = new Content({
      userId,
      clientId,
      platform: template.platform,
      type: template.format,
      content: template.template.caption || '',
      hashtags: template.template.hashtags || [],
      status: 'draft',
      metadata: {
        createdFromPlaybook: true,
        templateName: template.name
      }
    });

    await content.save();
    return content;
  } catch (error) {
    logger.error('Error creating content from template', { error: error.message });
    throw error;
  }
}

/**
 * Get playbook performance
 */
async function getPlaybookPerformance(playbookId) {
  try {
    const playbook = await Playbook.findById(playbookId).lean();
    if (!playbook) {
      throw new Error('Playbook not found');
    }

    // Get content created from this playbook
    const contents = await Content.find({
      'metadata.createdFromPlaybook': true,
      'metadata.templateName': { $in: playbook.contentTemplates.map(t => t.name) }
    }).lean();

    // Calculate performance
    const performance = {
      totalUses: playbook.stats.timesUsed,
      totalClients: playbook.stats.clientsUsed,
      totalContentCreated: contents.length,
      averagePerformance: playbook.stats.averagePerformance,
      successRate: playbook.stats.successRate
    };

    return performance;
  } catch (error) {
    logger.error('Error getting playbook performance', { error: error.message, playbookId });
    throw error;
  }
}

/**
 * Get playbook suggestions for client
 */
async function getPlaybookSuggestions(userId, clientId) {
  try {
    // Get client's content gaps and needs
    const WorkloadDashboardService = require('./workloadDashboardService');
    const dashboard = await WorkloadDashboardService.getWorkloadDashboard(userId, clientId);
    
    const suggestions = [];

    // Suggest based on content gaps
    if (dashboard.contentGaps.overallGapScore > 20) {
      suggestions.push({
        playbook: 'content_gap_filler',
        reason: 'High content gap score detected',
        priority: 'high'
      });
    }

    // Suggest based on category
    const playbooks = await getPlaybooks(userId, { includePublic: true });
    
    return playbooks
      .map(p => ({
        id: p._id,
        name: p.name,
        category: p.category,
        reason: `Matches client needs`,
        priority: 'medium'
      }))
      .slice(0, 5);
  } catch (error) {
    logger.error('Error getting playbook suggestions', { error: error.message, userId, clientId });
    return [];
  }
}

module.exports = {
  createPlaybook,
  getPlaybooks,
  applyPlaybookToClient,
  getPlaybookPerformance,
  getPlaybookSuggestions
};


