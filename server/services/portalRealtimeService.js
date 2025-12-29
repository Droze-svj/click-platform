// Portal Real-time Service
// Real-time updates for client portal

const { getSocketService } = require('./socketService');
const PortalActivity = require('../models/PortalActivity');
const logger = require('../utils/logger');

/**
 * Emit portal update
 */
function emitPortalUpdate(portalId, update) {
  try {
    const io = getSocketService();
    if (!io) {
      logger.warn('Socket service not initialized');
      return;
    }

    io.to(`portal-${portalId}`).emit('portal:update', {
      type: update.type,
      data: update.data,
      timestamp: new Date()
    });

    logger.debug('Portal update emitted', { portalId, type: update.type });
  } catch (error) {
    logger.error('Error emitting portal update', { error: error.message, portalId });
  }
}

/**
 * Create activity and emit update
 */
async function createActivity(portalId, clientWorkspaceId, activityData) {
  try {
    const activity = new PortalActivity({
      portalId,
      clientWorkspaceId,
      ...activityData
    });

    await activity.save();

    // Emit real-time update
    emitPortalUpdate(portalId, {
      type: 'activity',
      data: activity
    });

    return activity;
  } catch (error) {
    logger.error('Error creating portal activity', { error: error.message, portalId });
    throw error;
  }
}

/**
 * Handle post scheduled
 */
async function handlePostScheduled(portalId, clientWorkspaceId, post) {
  await createActivity(portalId, clientWorkspaceId, {
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
}

/**
 * Handle post published
 */
async function handlePostPublished(portalId, clientWorkspaceId, post) {
  await createActivity(portalId, clientWorkspaceId, {
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
}

/**
 * Handle content approved
 */
async function handleContentApproved(portalId, clientWorkspaceId, approval, approver) {
  await createActivity(portalId, clientWorkspaceId, {
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
}

/**
 * Handle link clicked
 */
async function handleLinkClicked(portalId, clientWorkspaceId, link, click) {
  await createActivity(portalId, clientWorkspaceId, {
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
}

module.exports = {
  emitPortalUpdate,
  createActivity,
  handlePostScheduled,
  handlePostPublished,
  handleContentApproved,
  handleLinkClicked
};


