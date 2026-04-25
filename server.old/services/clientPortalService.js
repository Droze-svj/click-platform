// Client Portal Service
// Client login portal with calendar, drafts, and performance dashboards

const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const ClientPortalUser = require('../models/ClientPortalUser');
const Workspace = require('../models/Workspace');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const ContentApproval = require('../models/ContentApproval');
const logger = require('../utils/logger');

/**
 * Get client portal dashboard data
 */
async function getClientPortalDashboard(portalId, userId) {
  try {
    const portalUser = await ClientPortalUser.findById(userId)
      .populate('portalId')
      .populate('clientWorkspaceId');

    if (!portalUser || portalUser.portalId._id.toString() !== portalId.toString()) {
      throw new Error('Unauthorized access');
    }

    const portal = portalUser.portalId;
    const clientWorkspace = portalUser.clientWorkspaceId;

    // Get calendar (upcoming posts)
    const calendar = await getClientCalendar(clientWorkspace._id, portalUser.permissions.canViewCalendar);

    // Get drafts awaiting approval
    const drafts = await getDraftsAwaitingApproval(clientWorkspace._id, portalUser.permissions.canViewDrafts);

    // Get performance dashboard
    const performance = await getClientPerformance(clientWorkspace._id, portalUser.permissions.canViewAnalytics);

    return {
      portal: {
        name: portal.branding?.name || clientWorkspace.name,
        logo: portal.branding?.logo,
        primaryColor: portal.branding?.primaryColor,
        secondaryColor: portal.branding?.secondaryColor
      },
      calendar,
      drafts,
      performance,
      permissions: portalUser.permissions
    };
  } catch (error) {
    logger.error('Error getting client portal dashboard', { error: error.message, portalId, userId });
    throw error;
  }
}

/**
 * Get client calendar
 */
async function getClientCalendar(clientWorkspaceId, canView) {
  if (!canView) {
    return { posts: [], summary: {} };
  }

  const now = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // Next 30 days

  const posts = await ScheduledPost.find({
    clientWorkspaceId,
    scheduledTime: {
      $gte: now,
      $lte: endDate
    },
    status: { $in: ['scheduled', 'pending'] }
  })
    .populate('contentId', 'title type')
    .sort({ scheduledTime: 1 })
    .limit(50)
    .lean();

  const summary = {
    total: posts.length,
    byPlatform: {},
    byStatus: {},
    nextPost: posts.length > 0 ? posts[0].scheduledTime : null
  };

  posts.forEach(post => {
    summary.byPlatform[post.platform] = (summary.byPlatform[post.platform] || 0) + 1;
    summary.byStatus[post.status] = (summary.byStatus[post.status] || 0) + 1;
  });

  return { posts, summary };
}

/**
 * Get drafts awaiting approval
 */
async function getDraftsAwaitingApproval(clientWorkspaceId, canView) {
  if (!canView) {
    return { drafts: [], summary: {} };
  }

  const approvals = await ContentApproval.find({
    workspaceId: clientWorkspaceId,
    status: 'pending'
  })
    .populate('contentId', 'title type content')
    .populate('requestedBy', 'name email')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const drafts = approvals.map(approval => ({
    id: approval._id,
    contentId: approval.contentId?._id,
    title: approval.contentId?.title || 'Untitled',
    type: approval.contentId?.type,
    preview: approval.contentId?.content?.text?.substring(0, 200),
    requestedBy: approval.requestedBy?.name,
    requestedAt: approval.createdAt,
    status: approval.status,
    comments: approval.comments || []
  }));

  const summary = {
    total: drafts.length,
    awaitingReview: drafts.filter(d => d.status === 'pending').length,
    byType: {}
  };

  drafts.forEach(draft => {
    summary.byType[draft.type] = (summary.byType[draft.type] || 0) + 1;
  });

  return { drafts, summary };
}

/**
 * Get client performance dashboard
 */
async function getClientPerformance(clientWorkspaceId, canView) {
  if (!canView) {
    return { metrics: {}, trends: [] };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get posted content
  const postedPosts = await ScheduledPost.find({
    clientWorkspaceId,
    status: 'posted',
    scheduledTime: { $gte: thirtyDaysAgo }
  }).lean();

  // Calculate metrics
  const metrics = {
    totalPosts: postedPosts.length,
    totalEngagement: postedPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0),
    totalReach: postedPosts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0),
    totalClicks: postedPosts.reduce((sum, p) => sum + (p.analytics?.clicks || 0), 0),
    averageEngagement: 0,
    averageReach: 0,
    topPlatform: null,
    topPost: null
  };

  if (postedPosts.length > 0) {
    metrics.averageEngagement = Math.round(metrics.totalEngagement / postedPosts.length);
    metrics.averageReach = Math.round(metrics.totalReach / postedPosts.length);

    // Find top platform
    const platformEngagement = {};
    postedPosts.forEach(post => {
      const platform = post.platform;
      platformEngagement[platform] = (platformEngagement[platform] || 0) + (post.analytics?.engagement || 0);
    });
    metrics.topPlatform = Object.entries(platformEngagement)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Find top post
    const topPost = postedPosts
      .sort((a, b) => (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0))[0];
    if (topPost) {
      metrics.topPost = {
        id: topPost._id,
        platform: topPost.platform,
        engagement: topPost.analytics?.engagement || 0,
        scheduledTime: topPost.scheduledTime
      };
    }
  }

  // Calculate trends (daily for last 7 days)
  const trends = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const dayPosts = postedPosts.filter(p => {
      const postDate = new Date(p.scheduledTime);
      return postDate >= date && postDate < nextDate;
    });

    trends.push({
      date: date.toISOString().split('T')[0],
      posts: dayPosts.length,
      engagement: dayPosts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0),
      reach: dayPosts.reduce((sum, p) => sum + (p.analytics?.impressions || 0), 0)
    });
  }

  return { metrics, trends };
}

/**
 * Authenticate client portal user
 */
async function authenticatePortalUser(portalId, email, password) {
  try {
    const user = await ClientPortalUser.findOne({
      email: email.toLowerCase(),
      portalId,
      isActive: true
    });

    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    return {
      success: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions
      }
    };
  } catch (error) {
    logger.error('Error authenticating portal user', { error: error.message, portalId });
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Create client portal user
 */
async function createPortalUser(portalId, userData) {
  try {
    const portal = await WhiteLabelPortal.findById(portalId);
    if (!portal) {
      throw new Error('Portal not found');
    }

    const user = new ClientPortalUser({
      ...userData,
      portalId,
      clientWorkspaceId: portal.clientId,
      agencyWorkspaceId: portal.workspaceId
    });

    await user.save();
    return user;
  } catch (error) {
    logger.error('Error creating portal user', { error: error.message, portalId });
    throw error;
  }
}

module.exports = {
  getClientPortalDashboard,
  authenticatePortalUser,
  createPortalUser,
  getClientCalendar,
  getDraftsAwaitingApproval,
  getClientPerformance
};


