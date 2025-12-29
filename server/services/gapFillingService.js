// Gap Filling Service
// Automatically generate content to fill identified gaps

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentHealth = require('../models/ContentHealth');
const logger = require('../utils/logger');

// Optional: Try to load content generation service, fallback if not available
let generateContent = null;
try {
  const contentGenService = require('./contentGenerationService');
  generateContent = contentGenService.generateContent;
} catch (error) {
  logger.warn('Content generation service not available', { error: error.message });
  generateContent = async () => ({ success: false, message: 'Service not available' });
}

/**
 * Generate content to fill gaps
 */
async function fillContentGaps(clientWorkspaceId, gapData, options = {}) {
  try {
    const {
      autoSchedule = false,
      maxItems = 5,
      priority = 'high'
    } = options;

    const generatedContent = [];
    const errors = [];

    // Filter gaps by priority
    const gapsToFill = gapData.gaps
      .filter(gap => {
        if (priority === 'high') return gap.priority >= 7;
        if (priority === 'medium') return gap.priority >= 5;
        return true;
      })
      .slice(0, maxItems);

    for (const gap of gapsToFill) {
      try {
        let contentData = null;

        // Generate content based on gap type
        switch (gap.category) {
          case 'platform':
            contentData = await generateContentForPlatform(
              clientWorkspaceId,
              gap.description,
              gap.recommendation
            );
            break;

          case 'format':
            contentData = await generateContentForFormat(
              clientWorkspaceId,
              gap.description,
              gap.recommendation
            );
            break;

          case 'topic':
            contentData = await generateContentForTopic(
              clientWorkspaceId,
              gap.description,
              gap.recommendation
            );
            break;

          default:
            contentData = await generateGenericContent(
              clientWorkspaceId,
              gap.description,
              gap.recommendation
            );
        }

        if (contentData) {
          // Create content
          const content = new Content({
            ...contentData,
            workspaceId: clientWorkspaceId,
            metadata: {
              ...contentData.metadata,
              gapFilled: true,
              gapId: gap._id || gap.category,
              gapType: gap.category
            }
          });

          await content.save();

          // Auto-schedule if enabled
          if (autoSchedule && contentData.platform) {
            const scheduledPost = new ScheduledPost({
              contentId: content._id,
              userId: options.userId,
              workspaceId: clientWorkspaceId,
              platform: contentData.platform,
              content: content.content,
              scheduledTime: options.scheduledTime || calculateOptimalTime(contentData.platform),
              status: 'pending',
              metadata: {
                gapFilled: true
              }
            });

            await scheduledPost.save();
            generatedContent.push({
              content,
              scheduledPost,
              gap
            });
          } else {
            generatedContent.push({
              content,
              gap
            });
          }
        }
      } catch (error) {
        errors.push({
          gap,
          error: error.message
        });
        logger.warn('Error filling gap', { gap: gap.category, error: error.message });
      }
    }

    logger.info('Content gaps filled', {
      clientWorkspaceId,
      filled: generatedContent.length,
      errors: errors.length
    });

    return {
      generated: generatedContent,
      errors,
      summary: {
        total: gapsToFill.length,
        successful: generatedContent.length,
        failed: errors.length
      }
    };
  } catch (error) {
    logger.error('Error filling content gaps', { error: error.message, clientWorkspaceId });
    throw error;
  }
}

/**
 * Generate content for platform gap
 */
async function generateContentForPlatform(clientWorkspaceId, description, recommendation) {
  try {
    // Extract platform from description
    const platformMatch = description.match(/not posting on (\w+)/i);
    const platform = platformMatch ? platformMatch[1].toLowerCase() : null;

    if (!platform) return null;

    // Get existing content to adapt
    const existingContent = await Content.findOne({ workspaceId: clientWorkspaceId })
      .sort({ createdAt: -1 })
      .lean();

    if (!existingContent) return null;

    // Generate platform-specific content
    const contentData = await generateContent({
      sourceContent: existingContent,
      targetPlatform: platform,
      adaptForPlatform: true
    });

    return {
      ...contentData,
      platform,
      type: 'post',
      title: `Content for ${platform}`,
      description: `Auto-generated content to fill ${platform} gap`
    };
  } catch (error) {
    logger.error('Error generating content for platform', { error: error.message });
    return null;
  }
}

/**
 * Generate content for format gap
 */
async function generateContentForFormat(clientWorkspaceId, description, recommendation) {
  try {
    // Extract format from description
    const formatMatch = description.match(/missing (\w+) content/i);
    const format = formatMatch ? formatMatch[1].toLowerCase() : 'video';

    // Get existing content to adapt
    const existingContent = await Content.findOne({ workspaceId: clientWorkspaceId })
      .sort({ createdAt: -1 })
      .lean();

    if (!existingContent) return null;

    // Generate format-specific content
    const contentData = await generateContent({
      sourceContent: existingContent,
      targetFormat: format,
      adaptForFormat: true
    });

    return {
      ...contentData,
      type: format,
      title: `${format} content`,
      description: `Auto-generated ${format} content to fill format gap`
    };
  } catch (error) {
    logger.error('Error generating content for format', { error: error.message });
    return null;
  }
}

/**
 * Generate content for topic gap
 */
async function generateContentForTopic(clientWorkspaceId, description, recommendation) {
  try {
    // Extract topic from description/recommendation
    const topic = recommendation || description;

    // Generate topic-based content
    const contentData = await generateContent({
      topic,
      contentType: 'post',
      generateFromScratch: true
    });

    return {
      ...contentData,
      type: 'post',
      title: `Content about ${topic}`,
      description: `Auto-generated content to fill topic gap: ${topic}`
    };
  } catch (error) {
    logger.error('Error generating content for topic', { error: error.message });
    return null;
  }
}

/**
 * Generate generic content
 */
async function generateGenericContent(clientWorkspaceId, description, recommendation) {
  try {
    const contentData = await generateContent({
      prompt: recommendation || description,
      contentType: 'post',
      generateFromScratch: true
    });

    return {
      ...contentData,
      type: 'post',
      title: 'Gap-filling content',
      description: description
    };
  } catch (error) {
    logger.error('Error generating generic content', { error: error.message });
    return null;
  }
}

/**
 * Calculate optimal posting time
 */
function calculateOptimalTime(platform) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

/**
 * Bulk fill gaps across clients
 */
async function bulkFillGaps(agencyWorkspaceId, filters = {}) {
  try {
    const {
      clientWorkspaceIds = [],
      priority = 'high',
      maxItemsPerClient = 5
    } = filters;

    // Get clients
    const Workspace = require('../models/Workspace');
    const clients = await Workspace.find({
      agencyWorkspaceId,
      ...(clientWorkspaceIds.length > 0 ? { _id: { $in: clientWorkspaceIds } } : {})
    }).lean();

    const results = {
      total: clients.length,
      successful: 0,
      failed: 0,
      totalGenerated: 0,
      errors: []
    };

    for (const client of clients) {
      try {
        // Get latest health analysis
        const health = await ContentHealth.findOne({ clientWorkspaceId: client._id })
          .sort({ analysisDate: -1 })
          .lean();

        if (!health || !health.gaps || health.gaps.length === 0) {
          continue;
        }

        const result = await fillContentGaps(client._id, health, {
          autoSchedule: true,
          maxItems: maxItemsPerClient,
          priority
        });

        results.successful++;
        results.totalGenerated += result.summary.successful;
      } catch (error) {
        results.failed++;
        results.errors.push({
          clientWorkspaceId: client._id,
          error: error.message
        });
      }
    }

    logger.info('Bulk gap filling completed', results);
    return results;
  } catch (error) {
    logger.error('Error in bulk gap filling', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  fillContentGaps,
  bulkFillGaps
};

