// Portal Activity Hooks
// Automatically create activities for portal events

const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const { createActivity } = require('./portalRealtimeService');
const logger = require('../utils/logger');

/**
 * Find portal for client workspace
 */
async function findPortalForClient(clientWorkspaceId) {
  try {
    const portal = await WhiteLabelPortal.findOne({
      clientId: clientWorkspaceId,
      isActive: true
    });
    return portal;
  } catch (error) {
    logger.warn('Error finding portal for client', { error: error.message, clientWorkspaceId });
    return null;
  }
}

/**
 * Hook: Post scheduled
 */
async function onPostScheduled(post) {
  try {
    if (!post.clientWorkspaceId || !post.agencyWorkspaceId) return;

    const portal = await findPortalForClient(post.clientWorkspaceId);
    if (!portal) return;

    await createActivity(portal._id, post.clientWorkspaceId, {
      type: 'post_scheduled',
      actor: {
        userId: post.userId,
        type: 'agency'
      },
      target: {
        type: 'post',
        id: post._id,
        title: `Post scheduled for ${post.platform}`
      },
      metadata: {
        platform: post.platform,
        scheduledTime: post.scheduledTime
      }
    });
  } catch (error) {
    logger.warn('Error in post scheduled hook', { error: error.message });
  }
}

/**
 * Hook: Post published
 */
async function onPostPublished(post) {
  try {
    if (!post.clientWorkspaceId || !post.agencyWorkspaceId) return;

    const portal = await findPortalForClient(post.clientWorkspaceId);
    if (!portal) return;

    await createActivity(portal._id, post.clientWorkspaceId, {
      type: 'post_published',
      actor: {
        userId: post.userId,
        type: 'agency'
      },
      target: {
        type: 'post',
        id: post._id,
        title: `Post published on ${post.platform}`
      },
      metadata: {
        platform: post.platform,
        engagement: post.analytics?.engagement || 0
      }
    });
  } catch (error) {
    logger.warn('Error in post published hook', { error: error.message });
  }
}

/**
 * Hook: Content approved
 */
async function onContentApproved(approval, approver) {
  try {
    if (!approval.workspaceId) return;

    const portal = await findPortalForClient(approval.workspaceId);
    if (!portal) return;

    await createActivity(portal._id, approval.workspaceId, {
      type: 'content_approved',
      actor: {
        portalUserId: approver._id,
        name: approver.name,
        type: 'client'
      },
      target: {
        type: 'content',
        id: approval.contentId,
        title: 'Content approved'
      },
      metadata: {
        approvalId: approval._id
      }
    });
  } catch (error) {
    logger.warn('Error in content approved hook', { error: error.message });
  }
}

/**
 * Hook: Link clicked
 */
async function onLinkClicked(link, click) {
  try {
    if (!link.clientWorkspaceId || !link.agencyWorkspaceId) return;

    const portal = await findPortalForClient(link.clientWorkspaceId);
    if (!portal) return;

    await createActivity(portal._id, link.clientWorkspaceId, {
      type: 'link_clicked',
      actor: {
        type: 'external'
      },
      target: {
        type: 'link',
        id: link._id,
        title: link.metadata?.title || 'Link clicked'
      },
      metadata: {
        country: click.country,
        device: click.device
      }
    });
  } catch (error) {
    logger.warn('Error in link clicked hook', { error: error.message });
  }
}

module.exports = {
  onPostScheduled,
  onPostPublished,
  onContentApproved,
  onLinkClicked
};


