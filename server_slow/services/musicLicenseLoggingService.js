// Music License Logging Service
// Logs all music track usage for licensing compliance

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');
const MusicLicense = require('../models/MusicLicense');
const Music = require('../models/Music');
const MusicGeneration = require('../models/MusicGeneration');

/**
 * Log music track usage when rendering
 */
async function logTrackUsage(trackUsage, options = {}) {
  const {
    trackId,
    source,
    userId,
    workspaceId,
    projectId,
    contentId,
    renderId,
    exportFormat,
    exportResolution,
    exportPlatform
  } = trackUsage;

  try {
    // Get track license information
    const licenseInfo = await getTrackLicenseInfo(trackId, source);

    // Create usage log
    const usageLog = new MusicLicenseUsage({
      trackId,
      source,
      provider: licenseInfo.provider,
      providerTrackId: licenseInfo.providerTrackId,
      licenseType: licenseInfo.licenseType,
      licenseId: licenseInfo.licenseId,
      userId,
      workspaceId,
      projectId,
      contentId,
      renderId: renderId || generateRenderId(),
      renderTimestamp: new Date(),
      exportFormat,
      exportResolution,
      exportPlatform,
      attributionRequired: licenseInfo.requiresAttribution,
      attributionText: licenseInfo.attributionText,
      trackTitle: await getTrackTitle(trackId, source),
      trackArtist: await getTrackArtist(trackId, source),
      restrictions: {
        downloadRawAudio: !licenseInfo.allowsRawDownload,
        exportInVideoOnly: licenseInfo.exportInVideoOnly
      }
    });

    await usageLog.save();

    logger.info('Music license usage logged', {
      trackId,
      source,
      userId,
      renderId: usageLog.renderId,
      licenseType: licenseInfo.licenseType
    });

    return usageLog;
  } catch (error) {
    logger.error('Error logging track usage', {
      error: error.message,
      trackUsage
    });
    throw error;
  }
}

/**
 * Log multiple tracks from a render
 */
async function logRenderUsage(tracks, renderContext, options = {}) {
  const {
    userId,
    workspaceId,
    projectId,
    contentId,
    renderId,
    exportFormat,
    exportResolution,
    exportPlatform
  } = renderContext;

  try {
    const usageLogs = [];

    for (const track of tracks) {
      const usageLog = await logTrackUsage({
        trackId: track.trackId || track.id,
        source: track.source,
        userId,
        workspaceId,
        projectId,
        contentId,
        renderId,
        exportFormat,
        exportResolution,
        exportPlatform
      });

      usageLogs.push(usageLog);
    }

    return {
      renderId: renderId || usageLogs[0]?.renderId,
      tracksLogged: usageLogs.length,
      usageLogs
    };
  } catch (error) {
    logger.error('Error logging render usage', {
      error: error.message,
      renderContext
    });
    throw error;
  }
}

/**
 * Get track license information
 */
async function getTrackLicenseInfo(trackId, source) {
  try {
    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).lean();
      if (!license) {
        throw new Error('License not found');
      }

      return {
        provider: license.provider,
        providerTrackId: license.providerTrackId,
        licenseType: license.licenseType || 'platform',
        licenseId: license._id,
        requiresAttribution: license.requiresAttribution,
        attributionText: license.attributionText,
        allowsRawDownload: false, // Licensed tracks typically don't allow raw download
        exportInVideoOnly: true
      };
    } else if (source === 'ai_generated') {
      const MusicGeneration = require('../models/MusicGeneration');
      const generation = await MusicGeneration.findById(trackId).lean();

      return {
        provider: generation?.provider || 'unknown',
        providerTrackId: generation?.trackId,
        licenseType: 'ai_generated',
        licenseId: null,
        requiresAttribution: false,
        attributionText: null,
        allowsRawDownload: true, // AI-generated tracks can be downloaded
        exportInVideoOnly: false
      };
    } else if (source === 'user_upload') {
      const music = await Music.findById(trackId).lean();
      if (!music) {
        throw new Error('User music not found');
      }

      return {
        provider: 'user_upload',
        providerTrackId: null,
        licenseType: music.licenseAttestation ? 'user_owned' : 'unknown',
        licenseId: null,
        requiresAttribution: music.requiresAttribution || false,
        attributionText: music.attributionText,
        allowsRawDownload: true, // User uploads can be downloaded by owner
        exportInVideoOnly: false
      };
    }

    throw new Error('Invalid source type');
  } catch (error) {
    logger.error('Error getting track license info', {
      error: error.message,
      trackId,
      source
    });
    throw error;
  }
}

/**
 * Get track title
 */
async function getTrackTitle(trackId, source) {
  try {
    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).select('title').lean();
      return license?.title || null;
    } else if (source === 'user_upload') {
      const Music = require('../models/Music');
      const music = await Music.findById(trackId).select('title').lean();
      return music?.title || null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get track artist
 */
async function getTrackArtist(trackId, source) {
  try {
    if (source === 'licensed') {
      const license = await MusicLicense.findById(trackId).select('artist').lean();
      return license?.artist || null;
    } else if (source === 'user_upload') {
      const Music = require('../models/Music');
      const music = await Music.findById(trackId).select('artist').lean();
      return music?.artist || null;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Generate unique render ID
 */
function generateRenderId() {
  return `render_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get usage logs for user
 */
async function getUserUsageLogs(userId, options = {}) {
  const {
    startDate,
    endDate,
    provider,
    licenseType,
    limit = 100,
    offset = 0
  } = options;

  try {
    const query = { userId };

    if (startDate || endDate) {
      query.renderTimestamp = {};
      if (startDate) query.renderTimestamp.$gte = new Date(startDate);
      if (endDate) query.renderTimestamp.$lte = new Date(endDate);
    }

    if (provider) query.provider = provider;
    if (licenseType) query.licenseType = licenseType;

    const logs = await MusicLicenseUsage.find(query)
      .sort({ renderTimestamp: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await MusicLicenseUsage.countDocuments(query);

    return {
      logs,
      total,
      limit,
      offset
    };
  } catch (error) {
    logger.error('Error getting user usage logs', {
      error: error.message,
      userId
    });
    throw error;
  }
}

/**
 * Get usage statistics
 */
async function getUsageStatistics(options = {}) {
  const {
    userId,
    workspaceId,
    startDate,
    endDate
  } = options;

  try {
    const query = {};
    if (userId) query.userId = userId;
    if (workspaceId) query.workspaceId = workspaceId;
    if (startDate || endDate) {
      query.renderTimestamp = {};
      if (startDate) query.renderTimestamp.$gte = new Date(startDate);
      if (endDate) query.renderTimestamp.$lte = new Date(endDate);
    }

    const stats = await MusicLicenseUsage.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            provider: '$provider',
            licenseType: '$licenseType'
          },
          count: { $sum: 1 },
          uniqueTracks: { $addToSet: '$trackId' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          provider: '$_id.provider',
          licenseType: '$_id.licenseType',
          count: 1,
          uniqueTrackCount: { $size: '$uniqueTracks' },
          uniqueUserCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    return stats;
  } catch (error) {
    logger.error('Error getting usage statistics', {
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  logTrackUsage,
  logRenderUsage,
  getTrackLicenseInfo,
  getUserUsageLogs,
  getUsageStatistics
};

