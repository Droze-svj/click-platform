// Music Licensing Sync Service
// Background synchronization of licensed tracks from providers

const logger = require('../utils/logger');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const MusicLicense = require('../models/MusicLicense');
const { getProvider, storeLicensedTrack } = require('./musicLicensingProviderService');
const { invalidateProviderSearchCache } = require('./musicLicensingCache');

/**
 * Sync tracks from a provider
 */
async function syncProviderCatalog(providerName, options = {}) {
  const {
    maxTracks = 1000,
    genres = [],
    moods = [],
    updateExisting = true
  } = options;

  try {
    const provider = await getProvider(providerName);
    const config = await MusicProviderConfig.findOne({ provider: providerName });

    if (!config || !config.catalogEnabled) {
      throw new Error(`Provider ${providerName} not configured or catalog not enabled`);
    }

    logger.info('Starting catalog sync', { provider: providerName, maxTracks });

    let syncedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Search for tracks by genre/mood or get popular tracks
    const searchQueries = genres.length > 0 
      ? genres 
      : ['popular', 'trending', 'new'];

    for (const query of searchQueries) {
      if (syncedCount >= maxTracks) break;

      try {
        const tracks = await provider.searchTracks(query, {
          limit: Math.min(100, maxTracks - syncedCount),
          ...(moods.length > 0 && { mood: moods })
        });

        for (const track of tracks) {
          if (syncedCount >= maxTracks) break;

          try {
            // Get full track details
            const trackDetails = await provider.getTrackDetails(track.providerTrackId);
            
            // Validate license
            const licenseInfo = await provider.validateLicense(track.providerTrackId);

            // Only store tracks that allow embedding
            if (!licenseInfo.allowsEmbedding && !licenseInfo.allowsSaaSIntegration) {
              skippedCount++;
              continue;
            }

            // Check if track already exists
            const existing = await MusicLicense.findOne({
              provider: providerName,
              providerTrackId: track.providerTrackId
            });

            if (existing) {
              if (updateExisting) {
                // Update existing track
                existing.title = trackDetails.title;
                existing.artist = trackDetails.artist;
                existing.genre = trackDetails.genre || [];
                existing.mood = trackDetails.mood || [];
                existing.previewUrl = trackDetails.previewUrl;
                existing.thumbnailUrl = trackDetails.thumbnailUrl;
                existing.licenseStatus = 'active';
                await existing.save();
                updatedCount++;
              } else {
                skippedCount++;
              }
            } else {
              // Store new track
              await storeLicensedTrack(providerName, trackDetails, licenseInfo);
              syncedCount++;
            }
          } catch (error) {
            logger.warn('Error syncing track', {
              provider: providerName,
              trackId: track.providerTrackId,
              error: error.message
            });
            skippedCount++;
          }
        }
      } catch (error) {
        logger.warn('Error in search query', {
          provider: providerName,
          query,
          error: error.message
        });
      }
    }

    // Update provider sync status
    await MusicProviderConfig.findOneAndUpdate(
      { provider: providerName },
      {
        lastSyncedAt: new Date(),
        syncStatus: 'active'
      }
    );

    // Invalidate cache
    invalidateProviderSearchCache(providerName);

    logger.info('Catalog sync completed', {
      provider: providerName,
      synced: syncedCount,
      updated: updatedCount,
      skipped: skippedCount
    });

    return {
      success: true,
      synced: syncedCount,
      updated: updatedCount,
      skipped: skippedCount,
      total: syncedCount + updatedCount + skippedCount
    };
  } catch (error) {
    logger.error('Catalog sync failed', {
      provider: providerName,
      error: error.message
    });

    // Update provider sync status
    await MusicProviderConfig.findOneAndUpdate(
      { provider: providerName },
      {
        syncStatus: 'failed',
        lastError: error.message
      }
    );

    throw error;
  }
}

/**
 * Sync all enabled providers
 */
async function syncAllProviders(options = {}) {
  const providers = await MusicProviderConfig.find({
    enabled: true,
    catalogEnabled: true
  });

  const results = await Promise.allSettled(
    providers.map(config => syncProviderCatalog(config.provider, options))
  );

  const summary = {
    total: providers.length,
    successful: 0,
    failed: 0,
    results: []
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      summary.successful++;
      summary.results.push({
        provider: providers[index].provider,
        ...result.value
      });
    } else {
      summary.failed++;
      summary.results.push({
        provider: providers[index].provider,
        success: false,
        error: result.reason?.message
      });
    }
  });

  return summary;
}

/**
 * Sync specific tracks (for manual sync)
 */
async function syncSpecificTracks(providerName, trackIds) {
  try {
    const provider = await getProvider(providerName);
    const results = [];

    for (const trackId of trackIds) {
      try {
        const trackDetails = await provider.getTrackDetails(trackId);
        const licenseInfo = await provider.validateLicense(trackId);

        if (licenseInfo.allowsEmbedding || licenseInfo.allowsSaaSIntegration) {
          const license = await storeLicensedTrack(providerName, trackDetails, licenseInfo);
          results.push({
            trackId,
            success: true,
            licenseId: license._id
          });
        } else {
          results.push({
            trackId,
            success: false,
            error: 'Track does not allow SaaS embedding'
          });
        }
      } catch (error) {
        results.push({
          trackId,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('Error syncing specific tracks', {
      provider: providerName,
      error: error.message
    });
    throw error;
  }
}

/**
 * Check and update expired licenses
 */
async function checkExpiredLicenses() {
  const now = new Date();
  const expired = await MusicLicense.find({
    licenseStatus: 'active',
    licenseEndDate: { $lte: now }
  });

  if (expired.length > 0) {
    await MusicLicense.updateMany(
      { _id: { $in: expired.map(e => e._id) } },
      { licenseStatus: 'expired' }
    );

    logger.info('Expired licenses updated', { count: expired.length });
  }

  return {
    expired: expired.length,
    licenses: expired.map(e => ({
      id: e._id,
      provider: e.provider,
      trackId: e.providerTrackId,
      expiredAt: e.licenseEndDate
    }))
  };
}

module.exports = {
  syncProviderCatalog,
  syncAllProviders,
  syncSpecificTracks,
  checkExpiredLicenses
};







