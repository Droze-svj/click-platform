// Master Calendar Service
// Aggregate all scheduled content across clients, platforms, and team members

const Workspace = require('../models/Workspace');
const ScheduledPost = require('../models/ScheduledPost');
const Content = require('../models/Content');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get master calendar for agency
 */
async function getMasterCalendar(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      clientWorkspaceIds = [],
      platforms = [],
      teamMemberIds = [],
      status = [],
      search = null,
      groupBy = 'date' // 'date', 'client', 'platform', 'team'
    } = filters;

    // Get all client workspaces for this agency
    const clientWorkspaces = await Workspace.find({
      type: 'client',
      $or: [
        { ownerId: { $in: await getAgencyUsers(agencyWorkspaceId) } },
        { 'metadata.agencyWorkspaceId': agencyWorkspaceId }
      ]
    }).lean();

    const clientWorkspaceIdsList = clientWorkspaceIds.length > 0
      ? clientWorkspaceIds
      : clientWorkspaces.map(ws => ws._id);

    // Build query
    const query = {
      agencyWorkspaceId,
      clientWorkspaceId: { $in: clientWorkspaceIdsList }
    };

    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    if (platforms.length > 0) {
      query.platform = { $in: platforms };
    }

    if (status.length > 0) {
      query.status = { $in: status };
    }

    if (teamMemberIds.length > 0) {
      query.userId = { $in: teamMemberIds };
    }

    // Get scheduled posts
    const posts = await ScheduledPost.find(query)
      .populate('userId', 'name email')
      .populate('contentId', 'title type')
      .populate('clientWorkspaceId', 'name type')
      .sort({ scheduledTime: 1 })
      .lean();

    // Apply search filter if provided
    let filteredPosts = posts;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPosts = posts.filter(post => {
        const contentTitle = post.contentId?.title?.toLowerCase() || '';
        const postText = post.content?.text?.toLowerCase() || '';
        const clientName = post.clientWorkspaceId?.name?.toLowerCase() || '';
        const userName = post.userId?.name?.toLowerCase() || '';
        return contentTitle.includes(searchLower) ||
               postText.includes(searchLower) ||
               clientName.includes(searchLower) ||
               userName.includes(searchLower);
      });
    }

    // Group posts based on groupBy parameter
    const grouped = groupPosts(filteredPosts, groupBy);

    // Get statistics
    const stats = calculateCalendarStats(filteredPosts, clientWorkspaces);

    return {
      posts: filteredPosts,
      grouped,
      stats,
      filters: {
        clientWorkspaces: clientWorkspaces.map(ws => ({
          id: ws._id,
          name: ws.name,
          type: ws.type
        })),
        platforms: [...new Set(filteredPosts.map(p => p.platform))],
        teamMembers: [...new Set(filteredPosts.map(p => ({
          id: p.userId?._id,
          name: p.userId?.name,
          email: p.userId?.email
        })).filter(m => m.id))]
      }
    };
  } catch (error) {
    logger.error('Error getting master calendar', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get agency users (team members)
 */
async function getAgencyUsers(agencyWorkspaceId) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId).populate('members.userId');
    if (!agency) {
      return [];
    }

    return agency.members
      .filter(m => m.status === 'active')
      .map(m => m.userId._id || m.userId);
  } catch (error) {
    logger.error('Error getting agency users', { error: error.message, agencyWorkspaceId });
    return [];
  }
}

/**
 * Group posts by different criteria
 */
function groupPosts(posts, groupBy) {
  const grouped = {};

  posts.forEach(post => {
    let key;

    switch (groupBy) {
      case 'date':
        key = new Date(post.scheduledTime).toISOString().split('T')[0];
        break;
      case 'client':
        key = post.clientWorkspaceId?._id?.toString() || 'unknown';
        break;
      case 'platform':
        key = post.platform;
        break;
      case 'team':
        key = post.userId?._id?.toString() || 'unknown';
        break;
      default:
        key = 'all';
    }

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(post);
  });

  return grouped;
}

/**
 * Calculate calendar statistics
 */
function calculateCalendarStats(posts, clientWorkspaces) {
  const stats = {
    total: posts.length,
    byStatus: {},
    byPlatform: {},
    byClient: {},
    byTeamMember: {},
    upcoming: 0,
    posted: 0,
    failed: 0,
    dateRange: {
      earliest: null,
      latest: null
    }
  };

  const now = new Date();

  posts.forEach(post => {
    // By status
    if (!stats.byStatus[post.status]) {
      stats.byStatus[post.status] = 0;
    }
    stats.byStatus[post.status]++;

    // By platform
    if (!stats.byPlatform[post.platform]) {
      stats.byPlatform[post.platform] = 0;
    }
    stats.byPlatform[post.platform]++;

    // By client
    const clientId = post.clientWorkspaceId?._id?.toString() || 'unknown';
    if (!stats.byClient[clientId]) {
      stats.byClient[clientId] = {
        name: post.clientWorkspaceId?.name || 'Unknown',
        count: 0
      };
    }
    stats.byClient[clientId].count++;

    // By team member
    const memberId = post.userId?._id?.toString() || 'unknown';
    if (!stats.byTeamMember[memberId]) {
      stats.byTeamMember[memberId] = {
        name: post.userId?.name || 'Unknown',
        count: 0
      };
    }
    stats.byTeamMember[memberId].count++;

    // Upcoming/posted/failed
    if (post.scheduledTime > now && post.status === 'scheduled') {
      stats.upcoming++;
    } else if (post.status === 'posted') {
      stats.posted++;
    } else if (post.status === 'failed') {
      stats.failed++;
    }

    // Date range
    if (!stats.dateRange.earliest || post.scheduledTime < stats.dateRange.earliest) {
      stats.dateRange.earliest = post.scheduledTime;
    }
    if (!stats.dateRange.latest || post.scheduledTime > stats.dateRange.latest) {
      stats.dateRange.latest = post.scheduledTime;
    }
  });

  return stats;
}

/**
 * Get calendar conflicts (overlapping posts)
 */
async function getCalendarConflicts(agencyWorkspaceId, filters = {}) {
  try {
    const {
      startDate,
      endDate,
      clientWorkspaceIds = [],
      platforms = []
    } = filters;

    const query = {
      agencyWorkspaceId,
      status: { $in: ['scheduled', 'pending'] }
    };

    if (clientWorkspaceIds.length > 0) {
      query.clientWorkspaceId = { $in: clientWorkspaceIds };
    }

    if (platforms.length > 0) {
      query.platform = { $in: platforms };
    }

    if (startDate || endDate) {
      query.scheduledTime = {};
      if (startDate) query.scheduledTime.$gte = new Date(startDate);
      if (endDate) query.scheduledTime.$lte = new Date(endDate);
    }

    const posts = await ScheduledPost.find(query)
      .populate('clientWorkspaceId', 'name')
      .populate('userId', 'name')
      .sort({ scheduledTime: 1 })
      .lean();

    const conflicts = [];
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        const post1 = posts[i];
        const post2 = posts[j];

        // Check if same platform and same client
        if (post1.platform === post2.platform &&
            post1.clientWorkspaceId?._id?.toString() === post2.clientWorkspaceId?._id?.toString()) {
          const timeDiff = Math.abs(new Date(post1.scheduledTime) - new Date(post2.scheduledTime));

          if (timeDiff < timeWindow) {
            conflicts.push({
              type: 'time_conflict',
              post1: {
                id: post1._id,
                scheduledTime: post1.scheduledTime,
                client: post1.clientWorkspaceId?.name,
                platform: post1.platform
              },
              post2: {
                id: post2._id,
                scheduledTime: post2.scheduledTime,
                client: post2.clientWorkspaceId?.name,
                platform: post2.platform
              },
              timeDiff: timeDiff / 1000 / 60 // minutes
            });
          }
        }
      }
    }

    return conflicts;
  } catch (error) {
    logger.error('Error getting calendar conflicts', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get calendar view (day/week/month)
 */
async function getCalendarView(agencyWorkspaceId, viewType = 'month', date = new Date(), filters = {}) {
  try {
    let startDate, endDate;

    switch (viewType) {
      case 'day':
        startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        const dayOfWeek = date.getDay();
        startDate = new Date(date);
        startDate.setDate(date.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
      default:
        startDate = new Date(date.getFullYear(), date.getMonth(), 1);
        endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
    }

    const calendar = await getMasterCalendar(agencyWorkspaceId, {
      ...filters,
      startDate,
      endDate
    });

    return {
      viewType,
      date,
      startDate,
      endDate,
      ...calendar
    };
  } catch (error) {
    logger.error('Error getting calendar view', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  getMasterCalendar,
  getCalendarConflicts,
  getCalendarView
};


