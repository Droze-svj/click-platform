// Comment Search Service
// Advanced comment search and filtering

const PostComment = require('../models/PostComment');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Search comments
 */
async function searchComments(agencyWorkspaceId, searchQuery, filters = {}) {
  try {
    const {
      postIds = [],
      userIds = [],
      dateRange = {},
      type = null,
      resolved = null,
      isInternal = null,
      mentions = []
    } = filters;

    // Get posts for this agency
    const posts = await ScheduledPost.find({
      agencyWorkspaceId
    }).select('_id').lean();

    const allPostIds = postIds.length > 0 ? postIds : posts.map(p => p._id);

    const query = {
      postId: { $in: allPostIds },
      deletedAt: null,
      $or: [
        { text: { $regex: searchQuery, $options: 'i' } }
      ]
    };

    if (userIds.length > 0) {
      query.userId = { $in: userIds };
    }

    if (type) {
      query.type = type;
    }

    if (resolved !== null) {
      query.resolved = resolved;
    }

    if (isInternal !== null) {
      query.isInternal = isInternal;
    }

    if (mentions.length > 0) {
      query.mentions = { $in: mentions };
    }

    if (dateRange.startDate || dateRange.endDate) {
      query.createdAt = {};
      if (dateRange.startDate) query.createdAt.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) query.createdAt.$lte = new Date(dateRange.endDate);
    }

    const comments = await PostComment.find(query)
      .populate('postId', 'platform scheduledTime')
      .populate('userId', 'name email')
      .populate('mentions', 'name email')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return {
      comments,
      total: comments.length,
      query: searchQuery
    };
  } catch (error) {
    logger.error('Error searching comments', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get comments by user
 */
async function getCommentsByUser(userId, filters = {}) {
  try {
    const {
      resolved = null,
      type = null,
      limit = 50
    } = filters;

    const query = { userId, deletedAt: null };
    if (resolved !== null) query.resolved = resolved;
    if (type) query.type = type;

    const comments = await PostComment.find(query)
      .populate('postId', 'platform scheduledTime content')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return comments;
  } catch (error) {
    logger.error('Error getting comments by user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get unresolved comments count
 */
async function getUnresolvedCommentsCount(postId) {
  try {
    const count = await PostComment.countDocuments({
      postId,
      resolved: false,
      deletedAt: null
    });

    return count;
  } catch (error) {
    logger.error('Error getting unresolved comments count', { error: error.message, postId });
    return 0;
  }
}

module.exports = {
  searchComments,
  getCommentsByUser,
  getUnresolvedCommentsCount
};


