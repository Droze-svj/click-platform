// Privacy Service for GDPR Compliance

const User = require('../models/User');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const SecurityLog = require('../models/SecurityLog');
const ErrorLog = require('../models/ErrorLog');
const logger = require('../utils/logger');
const { hashSensitiveData } = require('../utils/dataEncryption');

/**
 * Anonymize user data
 */
async function anonymizeUserData(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate anonymous identifier
    const anonymousId = `anon_${hashSensitiveData(userId.toString()).hash.substring(0, 16)}`;

    // Anonymize user data
    user.name = 'Anonymous User';
    user.email = `${anonymousId}@deleted.local`;
    user.whopUserId = null;
    user.anonymizedAt = new Date();

    await user.save();

    logger.info('User data anonymized', { userId, anonymousId });
    return { anonymousId, anonymized: true };
  } catch (error) {
    logger.error('Anonymize user data error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Delete user data (GDPR right to be forgotten)
 */
async function deleteUserData(userId) {
  try {
    // Delete user content
    await Content.deleteMany({ userId });
    logger.info('User content deleted', { userId });

    // Delete scheduled posts
    await ScheduledPost.deleteMany({ userId });
    logger.info('User scheduled posts deleted', { userId });

    // Delete security logs
    await SecurityLog.deleteMany({ userId });
    logger.info('User security logs deleted', { userId });

    // Delete error logs
    await ErrorLog.deleteMany({ userId });
    logger.info('User error logs deleted', { userId });

    // Delete user account
    await User.findByIdAndDelete(userId);
    logger.info('User account deleted', { userId });

    return { deleted: true };
  } catch (error) {
    logger.error('Delete user data error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Export user data (GDPR data portability)
 */
async function exportUserData(userId) {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }

    const content = await Content.find({ userId }).select('-__v');
    const scheduledPosts = await ScheduledPost.find({ userId }).select('-__v');
    const securityLogs = await SecurityLog.find({ userId }).select('-__v').limit(1000);
    const errorLogs = await ErrorLog.find({ userId }).select('-__v').limit(1000);

    const exportData = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        subscription: user.subscription,
        privacy: user.privacy,
        niche: user.niche,
        brandSettings: user.brandSettings,
      },
      content: content.map(c => ({
        id: c._id,
        title: c.title,
        body: c.body,
        type: c.type,
        platform: c.platform,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      scheduledPosts: scheduledPosts.map(p => ({
        id: p._id,
        contentId: p.contentId,
        platform: p.platform,
        scheduledTime: p.scheduledTime,
        status: p.status,
        createdAt: p.createdAt,
      })),
      securityLogs: securityLogs.map(l => ({
        id: l._id,
        event: l.event,
        ip: l.ip,
        userAgent: l.userAgent,
        timestamp: l.timestamp,
      })),
      errorLogs: errorLogs.map(l => ({
        id: l._id,
        errorType: l.errorType,
        errorMessage: l.errorMessage,
        statusCode: l.statusCode,
        timestamp: l.timestamp,
      })),
      exportedAt: new Date(),
      exportFormat: 'JSON',
    };

    logger.info('User data exported', { userId, contentCount: content.length });
    return exportData;
  } catch (error) {
    logger.error('Export user data error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check data retention compliance
 */
async function checkDataRetention() {
  try {
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '365');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Find users inactive beyond retention period
    const inactiveUsers = await User.find({
      'subscription.status': { $in: ['cancelled', 'expired'] },
      updatedAt: { $lt: cutoffDate },
      anonymizedAt: { $exists: false },
    });

    return {
      retentionDays,
      cutoffDate,
      inactiveUsersCount: inactiveUsers.length,
      inactiveUsers: inactiveUsers.map(u => ({
        id: u._id,
        email: u.email,
        lastActive: u.updatedAt,
      })),
    };
  } catch (error) {
    logger.error('Check data retention error', { error: error.message });
    throw error;
  }
}

/**
 * Process data retention (anonymize old data)
 */
async function processDataRetention() {
  try {
    const retentionCheck = await checkDataRetention();
    let anonymized = 0;

    for (const user of retentionCheck.inactiveUsers) {
      try {
        await anonymizeUserData(user._id);
        anonymized++;
      } catch (error) {
        logger.error('Failed to anonymize user', { userId: user._id, error: error.message });
      }
    }

    logger.info('Data retention processed', {
      checked: retentionCheck.inactiveUsersCount,
      anonymized,
    });

    return {
      checked: retentionCheck.inactiveUsersCount,
      anonymized,
    };
  } catch (error) {
    logger.error('Process data retention error', { error: error.message });
    throw error;
  }
}

/**
 * Get privacy settings for user
 */
async function getPrivacySettings(userId) {
  try {
    const user = await User.findById(userId).select('privacy');
    return user?.privacy || {
      dataConsent: false,
      marketingConsent: false,
      analyticsConsent: true,
      cookiesConsent: false,
      dataSharing: false,
    };
  } catch (error) {
    logger.error('Get privacy settings error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Update privacy settings
 */
async function updatePrivacySettings(userId, settings) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update privacy settings
    if (settings.dataSharing !== undefined) {
      user.privacy.dataSharing = settings.dataSharing;
    }
    if (settings.analytics !== undefined) {
      user.privacy.analyticsConsent = settings.analytics;
    }
    if (settings.marketing !== undefined) {
      user.privacy.marketingConsent = settings.marketing;
      if (settings.marketing && !user.privacy.marketingConsentDate) {
        user.privacy.marketingConsentDate = new Date();
      }
    }
    if (settings.cookies !== undefined) {
      user.privacy.cookiesConsent = settings.cookies === true || settings.cookies === 'all';
    }
    if (settings.dataConsent !== undefined) {
      user.privacy.dataConsent = settings.dataConsent;
      if (settings.dataConsent && !user.privacy.dataConsentDate) {
        user.privacy.dataConsentDate = new Date();
      }
    }

    await user.save();

    logger.info('Privacy settings updated', { userId, settings });
    return user.privacy;
  } catch (error) {
    logger.error('Update privacy settings error', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  anonymizeUserData,
  deleteUserData,
  exportUserData,
  checkDataRetention,
  processDataRetention,
  getPrivacySettings,
  updatePrivacySettings,
};


