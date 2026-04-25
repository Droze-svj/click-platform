// Admin Dashboard Service

const User = require('../models/User');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get admin dashboard overview
 */
async function getDashboardOverview(period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [
      totalUsers,
      newUsers,
      activeUsers,
      totalContent,
      newContent,
      scheduledPosts,
      systemHealth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ lastLogin: { $gte: startDate } }),
      Content.countDocuments(),
      Content.countDocuments({ createdAt: { $gte: startDate } }),
      ScheduledPost.countDocuments({ scheduledTime: { $gte: new Date() } }),
      getSystemHealth(),
    ]);

    return {
      period,
      users: {
        total: totalUsers,
        new: newUsers,
        active: activeUsers,
        growth: calculateGrowth(newUsers, totalUsers),
      },
      content: {
        total: totalContent,
        new: newContent,
        growth: calculateGrowth(newContent, totalContent),
      },
      scheduledPosts,
      systemHealth,
    };
  } catch (error) {
    logger.error('Get dashboard overview error', { error: error.message });
    throw error;
  }
}

/**
 * Get user management data
 */
async function getUserManagement(options = {}) {
  try {
    const {
      search = null,
      role = null,
      status = null,
      limit = 50,
      skip = 0,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = options;

    const query = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ [sortBy]: sortOrder })
        .limit(limit)
        .skip(skip)
        .select('-password')
        .lean(),
      User.countDocuments(query),
    ]);

    // Get user stats
    const usersWithStats = await Promise.all(
      users.map(async user => {
        const [contentCount, scheduledCount] = await Promise.all([
          Content.countDocuments({ userId: user._id }),
          ScheduledPost.countDocuments({ userId: user._id }),
        ]);

        return {
          ...user,
          stats: {
            contentCount,
            scheduledCount,
          },
        };
      })
    );

    return {
      users: usersWithStats,
      total,
      limit,
      skip,
    };
  } catch (error) {
    logger.error('Get user management error', { error: error.message });
    throw error;
  }
}

/**
 * Get content analytics
 */
async function getContentAnalytics(period = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const [
      byType,
      byStatus,
      topCreators,
      trends,
    ] = await Promise.all([
      Content.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
          },
        },
      ]),
      Content.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      Content.aggregate([
        {
          $match: { createdAt: { $gte: startDate } },
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            count: 1,
          },
        },
      ]),
      getContentTrends(startDate),
    ]);

    return {
      period,
      byType: byType.map(item => ({ type: item._id, count: item.count })),
      byStatus: byStatus.map(item => ({ status: item._id, count: item.count })),
      topCreators,
      trends,
    };
  } catch (error) {
    logger.error('Get content analytics error', { error: error.message });
    throw error;
  }
}

/**
 * Get system health
 */
async function getSystemHealth() {
  try {
    const cacheKey = 'admin:system-health';
    
    return await getOrSet(cacheKey, async () => {
      // Check database connection
      const mongoose = require('mongoose');
      const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';

      // Check Redis (if available)
      let redisStatus = 'not_configured';
      try {
        const redis = require('redis');
        const client = redis.createClient();
        await client.ping();
        redisStatus = 'healthy';
        await client.quit();
      } catch (error) {
        redisStatus = 'unhealthy';
      }

      // Check storage (S3 or local)
      const storageStatus = process.env.AWS_S3_BUCKET ? 's3' : 'local';

      return {
        database: dbStatus,
        redis: redisStatus,
        storage: storageStatus,
        timestamp: new Date(),
      };
    }, 60); // Cache for 1 minute
  } catch (error) {
    logger.error('Get system health error', { error: error.message });
    return {
      database: 'unknown',
      redis: 'unknown',
      storage: 'unknown',
      timestamp: new Date(),
    };
  }
}

/**
 * Get content trends
 */
async function getContentTrends(startDate) {
  try {
    const trends = await Content.aggregate([
      {
        $match: { createdAt: { $gte: startDate } },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    return trends.map(item => ({
      date: item._id,
      count: item.count,
    }));
  } catch (error) {
    logger.error('Get content trends error', { error: error.message });
    return [];
  }
}

/**
 * Calculate growth percentage
 */
function calculateGrowth(newCount, totalCount) {
  if (totalCount === 0) return 0;
  return Math.round((newCount / totalCount) * 100 * 100) / 100;
}

/**
 * Update user role
 */
async function updateUserRole(userId, newRole) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { role: newRole },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User role updated', { userId, newRole });
    return user;
  } catch (error) {
    logger.error('Update user role error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Suspend/activate user
 */
async function updateUserStatus(userId, status) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { status },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    logger.info('User status updated', { userId, status });
    return user;
  } catch (error) {
    logger.error('Update user status error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  getDashboardOverview,
  getUserManagement,
  getContentAnalytics,
  getSystemHealth,
  updateUserRole,
  updateUserStatus,
};






