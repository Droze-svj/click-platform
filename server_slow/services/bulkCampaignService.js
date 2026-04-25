// Bulk Campaign Service
// Clone campaigns across multiple clients with customization

const Campaign = require('../models/Campaign');
const Workspace = require('../models/Workspace');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const ClientGuidelines = require('../models/ClientGuidelines');
const { getOptimalPostingTimes } = require('./smartScheduleOptimizationService');
const logger = require('../utils/logger');

/**
 * Create campaign template
 */
async function createCampaign(agencyWorkspaceId, userId, campaignData) {
  try {
    const {
      name,
      description,
      templateContent,
      brandGuidelines,
      scheduling,
      platforms,
      variations,
      approvalWorkflow
    } = campaignData;

    const campaign = new Campaign({
      name,
      description,
      agencyWorkspaceId,
      createdBy: userId,
      templateContent,
      brandGuidelines,
      scheduling,
      platforms,
      variations,
      approvalWorkflow,
      status: 'draft'
    });

    await campaign.save();
    logger.info('Campaign created', { campaignId: campaign._id, agencyWorkspaceId });
    return campaign;
  } catch (error) {
    logger.error('Error creating campaign', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Clone campaign across multiple clients
 */
async function cloneCampaignToClients(campaignId, clientWorkspaceIds, options = {}) {
  try {
    const {
      customizeContent = true,
      applyBrandGuidelines = true,
      schedulePosts = true,
      customDates = null,
      approvalWorkflow = null
    } = options;

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const results = [];

    for (const clientWorkspaceId of clientWorkspaceIds) {
      try {
        const clientWorkspace = await Workspace.findById(clientWorkspaceId);
        if (!clientWorkspace || clientWorkspace.type !== 'client') {
          logger.warn('Invalid client workspace', { clientWorkspaceId });
          continue;
        }

        // Get client guidelines
        const guidelines = await ClientGuidelines.findOne({ workspaceId: clientWorkspaceId });

        // Customize content based on client guidelines
        let customizedContent = { ...campaign.templateContent };
        if (customizeContent && guidelines) {
          customizedContent = applyClientGuidelines(customizedContent, guidelines, campaign.brandGuidelines);
        }

        // Create client instance
        const clientInstance = {
          clientWorkspaceId,
          customizedContent,
          brandGuidelines: guidelines?.branding || campaign.brandGuidelines,
          status: schedulePosts ? 'pending' : 'draft',
          scheduledAt: schedulePosts ? new Date() : null
        };

        // Schedule posts if requested
        if (schedulePosts) {
          const scheduledPosts = await scheduleCampaignPosts(
            campaign,
            clientWorkspaceId,
            customizedContent,
            customDates,
            guidelines
          );
          clientInstance.scheduledPosts = scheduledPosts.map(p => p._id);
        }

        campaign.clientInstances.push(clientInstance);
        results.push({
          clientWorkspaceId,
          success: true,
          scheduledPosts: clientInstance.scheduledPosts?.length || 0
        });
      } catch (error) {
        logger.error('Error cloning campaign to client', {
          error: error.message,
          campaignId,
          clientWorkspaceId
        });
        results.push({
          clientWorkspaceId,
          success: false,
          error: error.message
        });
      }
    }

    campaign.status = 'active';
    await campaign.save();

    logger.info('Campaign cloned to clients', {
      campaignId,
      totalClients: clientWorkspaceIds.length,
      successful: results.filter(r => r.success).length
    });

    return {
      campaignId,
      results,
      totalClients: clientWorkspaceIds.length,
      successful: results.filter(r => r.success).length
    };
  } catch (error) {
    logger.error('Error cloning campaign', { error: error.message, campaignId });
    throw error;
  }
}

/**
 * Apply client guidelines to content
 */
function applyClientGuidelines(content, guidelines, campaignGuidelines) {
  const customized = { ...content };

  // Apply brand voice and tone
  if (guidelines.branding?.brandVoice) {
    // In production, use AI to adjust tone
    customized.text = adjustTone(customized.text, guidelines.branding.brandVoice);
  }

  // Apply color guidelines (for visual content)
  if (guidelines.branding?.primaryColor) {
    customized.brandColor = guidelines.branding.primaryColor;
  }

  // Apply content rules
  if (guidelines.contentRules) {
    // Replace do not use words
    if (guidelines.contentRules.doNotUse && customized.text) {
      guidelines.contentRules.doNotUse.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        customized.text = customized.text.replace(regex, '');
      });
    }

    // Add must include words
    if (guidelines.contentRules.mustInclude && customized.text) {
      guidelines.contentRules.mustInclude.forEach(phrase => {
        if (!customized.text.toLowerCase().includes(phrase.toLowerCase())) {
          customized.text += ` ${phrase}`;
        }
      });
    }

    // Apply hashtag strategy
    if (guidelines.contentRules.preferredHashtags && customized.hashtags) {
      customized.hashtags = [
        ...guidelines.contentRules.preferredHashtags,
        ...customized.hashtags.filter(h => !guidelines.contentRules.preferredHashtags.includes(h))
      ];
    }
  }

  // Apply platform-specific guidelines
  if (guidelines.platformSpecific) {
    customized.platformGuidelines = guidelines.platformSpecific;
  }

  return customized;
}

/**
 * Adjust content tone (simplified - in production use AI)
 */
function adjustTone(text, targetTone) {
  // Simplified tone adjustment
  // In production, use GPT-4 or similar to adjust tone
  return text; // Placeholder
}

/**
 * Schedule campaign posts for a client
 */
async function scheduleCampaignPosts(campaign, clientWorkspaceId, content, customDates, guidelines) {
  try {
    const scheduledPosts = [];
    const clientWorkspace = await Workspace.findById(clientWorkspaceId);
    const ownerId = clientWorkspace.ownerId;

    // Get scheduling configuration
    const scheduling = campaign.scheduling;
    const platforms = campaign.platforms || [];
    const startDate = customDates?.startDate || scheduling.startDate || new Date();
    const endDate = customDates?.endDate || scheduling.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Generate schedule dates
    const scheduleDates = generateScheduleDates(startDate, endDate, scheduling);

    // Create posts for each platform and date
    for (const platform of platforms) {
      for (const scheduleDate of scheduleDates) {
        // Get optimal time for this platform
        const optimalTime = await getOptimalPostingTimes(ownerId, platform, scheduleDate);
        const [hour, minute] = optimalTime.split(':').map(Number);
        const scheduledTime = new Date(scheduleDate);
        scheduledTime.setHours(hour, minute, 0, 0);

        // Apply variations if enabled
        const postContent = campaign.variations?.enabled
          ? applyVariations(content, campaign.variations, scheduledPosts.length)
          : content;

        const scheduledPost = new ScheduledPost({
          userId: ownerId,
          workspaceId: clientWorkspaceId,
          clientWorkspaceId,
          agencyWorkspaceId: campaign.agencyWorkspaceId,
          campaignId: campaign._id,
          platform,
          content: {
            text: postContent.text || postContent.description,
            mediaUrl: postContent.mediaUrl,
            hashtags: postContent.hashtags || [],
            mentions: postContent.mentions || []
          },
          scheduledTime,
          timezone: scheduling.timezone || 'UTC',
          status: 'scheduled'
        });

        await scheduledPost.save();
        scheduledPosts.push(scheduledPost);
      }
    }

    return scheduledPosts;
  } catch (error) {
    logger.error('Error scheduling campaign posts', { error: error.message, campaignId: campaign._id });
    throw error;
  }
}

/**
 * Generate schedule dates based on frequency
 */
function generateScheduleDates(startDate, endDate, scheduling) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  const daysOfWeek = scheduling.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]; // All days by default
  const times = scheduling.times || ['09:00', '15:00', '18:00'];

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (daysOfWeek.includes(dayOfWeek)) {
      for (const time of times) {
        const [hour, minute] = time.split(':').map(Number);
        const dateTime = new Date(current);
        dateTime.setHours(hour, minute, 0, 0);
        dates.push(dateTime);
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);

    // Apply frequency
    if (scheduling.frequency === 'weekly') {
      current.setDate(current.getDate() + 6); // Skip to next week
    } else if (scheduling.frequency === 'biweekly') {
      current.setDate(current.getDate() + 13); // Skip 2 weeks
    } else if (scheduling.frequency === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    }
  }

  return dates;
}

/**
 * Apply content variations
 */
function applyVariations(content, variations, index) {
  const varied = { ...content };

  // Rotate headline variations
  if (variations.headlineVariations && variations.headlineVariations.length > 0) {
    varied.title = variations.headlineVariations[index % variations.headlineVariations.length];
  }

  // Rotate caption variations
  if (variations.captionVariations && variations.captionVariations.length > 0) {
    varied.text = variations.captionVariations[index % variations.captionVariations.length];
  }

  // Rotate hashtag variations
  if (variations.hashtagVariations && variations.hashtagVariations.length > 0) {
    varied.hashtags = variations.hashtagVariations[index % variations.hashtagVariations.length];
  }

  return varied;
}

/**
 * Update campaign for specific clients
 */
async function updateCampaignForClients(campaignId, clientWorkspaceIds, updates) {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const results = [];

    for (const clientWorkspaceId of clientWorkspaceIds) {
      const instance = campaign.clientInstances.find(
        inst => inst.clientWorkspaceId.toString() === clientWorkspaceId.toString()
      );

      if (!instance) {
        results.push({
          clientWorkspaceId,
          success: false,
          error: 'Client instance not found'
        });
        continue;
      }

      // Update instance
      if (updates.customizedContent) {
        instance.customizedContent = {
          ...instance.customizedContent,
          ...updates.customizedContent
        };
      }

      if (updates.brandGuidelines) {
        instance.brandGuidelines = {
          ...instance.brandGuidelines,
          ...updates.brandGuidelines
        };
      }

      if (updates.status) {
        instance.status = updates.status;
      }

      results.push({
        clientWorkspaceId,
        success: true
      });
    }

    await campaign.save();

    logger.info('Campaign updated for clients', { campaignId, updated: results.length });
    return { campaignId, results };
  } catch (error) {
    logger.error('Error updating campaign', { error: error.message, campaignId });
    throw error;
  }
}

module.exports = {
  createCampaign,
  cloneCampaignToClients,
  updateCampaignForClients,
  applyClientGuidelines
};


