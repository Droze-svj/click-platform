// Bulk Template Service
// Apply templates to multiple clients at once

const CrossClientTemplate = require('../models/CrossClientTemplate');
const Content = require('../models/Content');
const Workspace = require('../models/Workspace');
const { applyTemplateToContent } = require('./crossClientTemplateService');
const logger = require('../utils/logger');

/**
 * Apply template to multiple clients
 */
async function bulkApplyTemplate(templateId, agencyWorkspaceId, options = {}) {
  try {
    const {
      clientWorkspaceIds = [],
      contentIds = [],
      autoSchedule = false,
      scheduledTime = null
    } = options;

    // Get clients if not specified
    let clients = [];
    if (clientWorkspaceIds.length > 0) {
      clients = await Workspace.find({
        _id: { $in: clientWorkspaceIds },
        agencyWorkspaceId
      }).lean();
    } else {
      // Get all clients for this agency
      clients = await Workspace.find({
        agencyWorkspaceId,
        type: 'client'
      }).lean();
    }

    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      totalPostsGenerated: 0,
      errors: []
    };

    for (const client of clients) {
      try {
        // Get content for this client
        let contentToProcess = [];
        if (contentIds.length > 0) {
          contentToProcess = await Content.find({
            _id: { $in: contentIds },
            workspaceId: client._id
          }).lean();
        } else {
          // Get recent content matching template source type
          const template = await CrossClientTemplate.findById(templateId);
          if (template) {
            contentToProcess = await Content.find({
              workspaceId: client._id,
              type: template.sourceType
            })
              .sort({ createdAt: -1 })
              .limit(5)
              .lean();
          }
        }

        if (contentToProcess.length === 0) {
          continue;
        }

        // Apply template to each content
        for (const content of contentToProcess) {
          try {
            const result = await applyTemplateToContent(
              templateId,
              content._id,
              client._id,
              {
                autoSchedule,
                scheduledTime,
                userId: options.userId
              }
            );

            results.total++;
            results.successful++;
            results.totalPostsGenerated += result.summary.successful;
          } catch (error) {
            results.total++;
            results.failed++;
            results.errors.push({
              clientWorkspaceId: client._id,
              contentId: content._id,
              error: error.message
            });
          }
        }
      } catch (error) {
        results.errors.push({
          clientWorkspaceId: client._id,
          error: error.message
        });
      }
    }

    logger.info('Bulk template application completed', {
      templateId,
      ...results
    });

    return results;
  } catch (error) {
    logger.error('Error in bulk template application', { error: error.message, templateId });
    throw error;
  }
}

module.exports = {
  bulkApplyTemplate
};


