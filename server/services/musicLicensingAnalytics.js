// Music Licensing Analytics Service
// Tracks usage, popularity, and compliance metrics

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicProviderConfig = require('../models/MusicProviderConfig');

/**
 * Get usage analytics for licensed music
 */
async function getUsageAnalytics(options = {}) {
  const {
    startDate,
    endDate,
    provider,
    groupBy = 'day'
  } = options;

  try {
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.lastUsedAt = {};
      if (startDate) matchStage.lastUsedAt.$gte = new Date(startDate);
      if (endDate) matchStage.lastUsedAt.$lte = new Date(endDate);
    }
    if (provider) matchStage.provider = provider;

    const groupFormat = {
      day: { $dateToString: { format: '%Y-%m-%d', date: '$lastUsedAt' } },
      week: { $dateToString: { format: '%Y-W%V', date: '$lastUsedAt' } },
      month: { $dateToString: { format: '%Y-%m', date: '$lastUsedAt' } }
    };

    const usageStats = await MusicLicense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupFormat[groupBy],
          totalUsage: { $sum: '$usageCount' },
          uniqueTracks: { $sum: 1 },
          totalTracks: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Provider breakdown
    const providerStats = await MusicLicense.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$provider',
          totalUsage: { $sum: '$usageCount' },
          trackCount: { $sum: 1 },
          activeTracks: {
            $sum: { $cond: [{ $eq: ['$licenseStatus', 'active'] }, 1, 0] }
          }
        }
      }
    ]);

    // Top tracks
    const topTracks = await MusicLicense.find(matchStage)
      .sort({ usageCount: -1 })
      .limit(10)
      .select('title artist provider usageCount lastUsedAt')
      .lean();

    // Genre/mood distribution
    const genreStats = await MusicLicense.aggregate([
      { $match: matchStage },
      { $unwind: '$genre' },
      {
        $group: {
          _id: '$genre',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const moodStats = await MusicLicense.aggregate([
      { $match: matchStage },
      { $unwind: '$mood' },
      {
        $group: {
          _id: '$mood',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usageCount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return {
      usageOverTime: usageStats,
      providerBreakdown: providerStats,
      topTracks,
      genreDistribution: genreStats,
      moodDistribution: moodStats
    };
  } catch (error) {
    logger.error('Error getting usage analytics', { error: error.message });
    throw error;
  }
}

/**
 * Get compliance metrics
 */
async function getComplianceMetrics() {
  try {
    const totalTracks = await MusicLicense.countDocuments();
    const activeTracks = await MusicLicense.countDocuments({ licenseStatus: 'active' });
    const expiredTracks = await MusicLicense.countDocuments({ licenseStatus: 'expired' });
    
    const tracksWithAttribution = await MusicLicense.countDocuments({
      requiresAttribution: true
    });

    const tracksRequiringRenewal = await MusicLicense.countDocuments({
      licenseStatus: 'active',
      licenseEndDate: {
        $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Expires in 30 days
      }
    });

    const tracksWithoutEmbedding = await MusicLicense.countDocuments({
      allowsEmbedding: false,
      allowsSaaSIntegration: false
    });

    return {
      totalTracks,
      activeTracks,
      expiredTracks,
      compliance: {
        tracksWithAttribution,
        tracksRequiringRenewal,
        tracksWithoutEmbedding,
        complianceRate: totalTracks > 0 
          ? ((activeTracks - tracksWithoutEmbedding) / totalTracks) * 100 
          : 0
      }
    };
  } catch (error) {
    logger.error('Error getting compliance metrics', { error: error.message });
    throw error;
  }
}

/**
 * Get provider performance metrics
 */
async function getProviderMetrics() {
  try {
    const providers = await MusicProviderConfig.find({ enabled: true }).lean();

    const metrics = await Promise.all(
      providers.map(async (provider) => {
        const tracks = await MusicLicense.find({ provider: provider.provider });
        const totalUsage = tracks.reduce((sum, track) => sum + (track.usageCount || 0), 0);
        const activeTracks = tracks.filter(t => t.licenseStatus === 'active').length;

        return {
          provider: provider.provider,
          enabled: provider.enabled,
          catalogEnabled: provider.catalogEnabled,
          totalTracks: tracks.length,
          activeTracks,
          totalUsage,
          averageUsagePerTrack: tracks.length > 0 ? totalUsage / tracks.length : 0,
          lastSyncedAt: provider.lastSyncedAt,
          syncStatus: provider.syncStatus
        };
      })
    );

    return metrics;
  } catch (error) {
    logger.error('Error getting provider metrics', { error: error.message });
    throw error;
  }
}

/**
 * Track track popularity
 */
async function trackTrackPopularity(trackId) {
  try {
    const track = await MusicLicense.findById(trackId);
    if (!track) return;

    // Update popularity score (weighted: recent usage counts more)
    const daysSinceLastUse = track.lastUsedAt
      ? (Date.now() - track.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
      : 365;

    const recencyWeight = Math.max(0, 1 - (daysSinceLastUse / 365));
    const popularityScore = (track.usageCount || 0) * (1 + recencyWeight * 0.5);

    await MusicLicense.findByIdAndUpdate(trackId, {
      $set: {
        'metadata.popularityScore': popularityScore,
        'metadata.lastPopularityUpdate': new Date()
      }
    });
  } catch (error) {
    logger.warn('Error tracking track popularity', { error: error.message, trackId });
  }
}

module.exports = {
  getUsageAnalytics,
  getComplianceMetrics,
  getProviderMetrics,
  trackTrackPopularity
};







