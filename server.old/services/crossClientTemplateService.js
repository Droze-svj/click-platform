// Cross-Client Template Service
// Apply templates to any client's long-form content

const CrossClientTemplate = require('../models/CrossClientTemplate');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

// Optional: Try to load services, fallback if not available
let generateContentFromLongForm = null;
let trackTemplateApplication = null;
try {
  const contentGenService = require('./contentGenerationService');
  generateContentFromLongForm = contentGenService.generateContentFromLongForm;
} catch (error) {
  logger.warn('Content generation service not available', { error: error.message });
  generateContentFromLongForm = async () => ({ success: false, message: 'Service not available' });
}

try {
  const templateAnalytics = require('./templateAnalyticsService');
  trackTemplateApplication = templateAnalytics.trackTemplateApplication;
} catch (error) {
  logger.warn('Template analytics service not available', { error: error.message });
  trackTemplateApplication = async () => {};
}

/**
 * Create cross-client template
 */
async function createCrossClientTemplate(agencyWorkspaceId, userId, templateData) {
  try {
    const template = new CrossClientTemplate({
      ...templateData,
      agencyWorkspaceId,
      createdBy: userId
    });

    await template.save();
    logger.info('Cross-client template created', { templateId: template._id, agencyWorkspaceId });
    return template;
  } catch (error) {
    logger.error('Error creating cross-client template', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Apply template to client content
 */
async function applyTemplateToContent(templateId, contentId, clientWorkspaceId, options = {}) {
  try {
    const template = await CrossClientTemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const content = await Content.findById(contentId);
    if (!content) {
      throw new Error('Content not found');
    }

    // Verify content type matches template source type
    if (content.type !== template.sourceType) {
      throw new Error(`Content type ${content.type} does not match template source type ${template.sourceType}`);
    }

    // Increment usage
    template.usageCount++;
    await template.save();

    const generatedPosts = [];
    const errors = [];

    // Generate outputs for each platform/format
    for (const output of template.outputs) {
      for (let i = 0; i < output.count; i++) {
        try {
          const postData = await generateContentFromLongForm(content, {
            platform: output.platform,
            format: output.format,
            config: output.config,
            processingRules: template.processingRules,
            aiConfig: template.aiConfig,
            clientWorkspaceId,
            templateId: template._id
          });

          // Create scheduled post if auto-schedule is enabled
          if (options.autoSchedule) {
            const scheduledPost = new ScheduledPost({
              contentId: postData.contentId || contentId,
              userId: options.userId,
              workspaceId: clientWorkspaceId,
              platform: output.platform,
              content: postData.content,
              scheduledTime: options.scheduledTime || calculateOptimalTime(output.platform),
              status: 'pending'
            });

            await scheduledPost.save();
            generatedPosts.push({
              post: scheduledPost,
              platform: output.platform,
              format: output.format
            });
          } else {
            generatedPosts.push({
              content: postData,
              platform: output.platform,
              format: output.format
            });
          }
        } catch (error) {
          errors.push({
            platform: output.platform,
            format: output.format,
            index: i,
            error: error.message
          });
          logger.warn('Error generating content from template', {
            templateId,
            contentId,
            platform: output.platform,
            error: error.message
          });
        }
      }
    }

    logger.info('Template applied to content', {
      templateId,
      contentId,
      clientWorkspaceId,
      generated: generatedPosts.length,
      errors: errors.length
    });

    // Track template application
    try {
      const workspace = await require('../models/Workspace').findById(clientWorkspaceId).lean();
      await trackTemplateApplication(templateId, {
        agencyWorkspaceId: template.agencyWorkspaceId,
        clientWorkspaceId,
        sourceContentId: contentId,
        generatedPosts
      });
    } catch (error) {
      logger.warn('Error tracking template application', { error: error.message });
    }

    return {
      template,
      generatedPosts,
      errors,
      summary: {
        total: generatedPosts.length,
        successful: generatedPosts.length - errors.length,
        failed: errors.length
      }
    };
  } catch (error) {
    logger.error('Error applying template to content', { error: error.message, templateId, contentId });
    throw error;
  }
}

/**
 * Calculate optimal posting time for platform
 */
function calculateOptimalTime(platform) {
  // This would use the optimal time prediction service
  // For now, return a default time (next day at 10 AM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  return tomorrow;
}

/**
 * Get templates for agency
 */
async function getAgencyTemplates(agencyWorkspaceId, filters = {}) {
  try {
    const {
      sourceType,
      category,
      isPublic = null
    } = filters;

    const query = { agencyWorkspaceId };
    if (sourceType) query.sourceType = sourceType;
    if (category) query.category = category;
    if (isPublic !== null) query.isPublic = isPublic;

    const templates = await CrossClientTemplate.find(query)
      .populate('createdBy', 'name email')
      .sort({ usageCount: -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting agency templates', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Create default templates
 */
async function createDefaultTemplates(agencyWorkspaceId, userId) {
  try {
    const templates = [];

    // Podcast → 10 short clips + 5 LinkedIn posts + 3 tweets
    const podcastTemplate = await createCrossClientTemplate(agencyWorkspaceId, userId, {
      name: 'Podcast to Multi-Platform',
      description: 'Transform podcast into 10 short clips, 5 LinkedIn posts, and 3 tweets',
      sourceType: 'podcast',
      outputs: [
        {
          platform: 'tiktok',
          format: 'short_clip',
          count: 5,
          config: {
            duration: 60,
            aspectRatio: '9:16',
            includeCaptions: true,
            style: 'educational'
          }
        },
        {
          platform: 'instagram',
          format: 'reel',
          count: 5,
          config: {
            duration: 60,
            aspectRatio: '9:16',
            includeCaptions: true,
            style: 'educational'
          }
        },
        {
          platform: 'linkedin',
          format: 'post',
          count: 5,
          config: {
            maxLength: 3000,
            includeHashtags: true,
            tone: 'professional'
          }
        },
        {
          platform: 'twitter',
          format: 'tweet',
          count: 3,
          config: {
            maxLength: 280,
            includeHashtags: true,
            tone: 'professional'
          }
        }
      ],
      processingRules: {
        extractKeyPoints: true,
        generateCaptions: true,
        optimizeForPlatform: true
      },
      category: 'podcast',
      isPublic: true
    });

    templates.push(podcastTemplate);

    // Video → 8 clips + 4 posts
    const videoTemplate = await createCrossClientTemplate(agencyWorkspaceId, userId, {
      name: 'Video to Social Media',
      description: 'Transform video into 8 short clips and 4 social posts',
      sourceType: 'video',
      outputs: [
        {
          platform: 'tiktok',
          format: 'short_clip',
          count: 4,
          config: {
            duration: 60,
            aspectRatio: '9:16'
          }
        },
        {
          platform: 'instagram',
          format: 'reel',
          count: 4,
          config: {
            duration: 60,
            aspectRatio: '9:16'
          }
        },
        {
          platform: 'linkedin',
          format: 'post',
          count: 2,
          config: {
            maxLength: 3000
          }
        },
        {
          platform: 'facebook',
          format: 'post',
          count: 2,
          config: {
            maxLength: 5000
          }
        }
      ],
      category: 'video',
      isPublic: true
    });

    templates.push(videoTemplate);

    return templates;
  } catch (error) {
    logger.error('Error creating default templates', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  createCrossClientTemplate,
  applyTemplateToContent,
  getAgencyTemplates,
  createDefaultTemplates
};

