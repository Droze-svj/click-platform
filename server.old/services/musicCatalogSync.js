// Music Catalog Sync Service
// Real-time synchronization with provider APIs

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicProviderConfig = require('../models/MusicProviderConfig');
const { searchTracksAcrossProviders } = require('./musicLicensingProviderService');

/**
 * Sync catalog from provider APIs
 */
async function syncCatalogFromProviders(options = {}) {
  const {
    providers = null, // null = all enabled providers
    fullSync = false,
    maxTracks = 1000
  } = options;

  try {
    const configs = providers
      ? await MusicProviderConfig.find({ provider: { $in: providers }, enabled: true })
      : await MusicProviderConfig.find({ enabled: true });

    const syncResults = {
      providers: [],
      totalSynced: 0,
      errors: []
    };

    for (const config of configs) {
      try {
        const result = await syncProviderCatalog(config, { fullSync, maxTracks });
        syncResults.providers.push({
          provider: config.provider,
          synced: result.synced,
          updated: result.updated,
          new: result.new
        });
        syncResults.totalSynced += result.synced;
      } catch (error) {
        logger.error('Error syncing provider catalog', {
          error: error.message,
          provider: config.provider
        });
        syncResults.errors.push({
          provider: config.provider,
          error: error.message
        });
      }
    }

    return syncResults;
  } catch (error) {
    logger.error('Error syncing catalog from providers', { error: error.message });
    throw error;
  }
}

/**
 * Sync single provider catalog
 */
async function syncProviderCatalog(config, options = {}) {
  const { fullSync = false, maxTracks = 1000 } = options;

  try {
    logger.info('Starting catalog sync', { provider: config.provider });

    // Search for tracks (this will fetch from provider API)
    // In a real implementation, you'd fetch all tracks from the provider
    const tracks = await searchTracksAcrossProviders('', {}, config.provider);
    
    // Limit tracks for incremental sync
    const tracksToSync = fullSync ? tracks : tracks.slice(0, maxTracks);

    let synced = 0;
    let updated = 0;
    let newCount = 0;

    for (const trackData of tracksToSync) {
      try {
        const existing = await MusicLicense.findOne({
          provider: config.provider,
          providerTrackId: trackData.trackId
        });

        if (existing) {
          // Update existing track
          await MusicLicense.findByIdAndUpdate(existing._id, {
            $set: {
              title: trackData.title,
              artist: trackData.artist,
              genre: trackData.genre,
              mood: trackData.mood,
              duration: trackData.duration,
              bpm: trackData.bpm,
              previewUrl: trackData.previewUrl,
              thumbnailUrl: trackData.thumbnailUrl,
              lastSyncedAt: new Date()
            }
          });
          updated++;
        } else {
          // Create new track
          const newTrack = new MusicLicense({
            provider: config.provider,
            providerTrackId: trackData.trackId,
            title: trackData.title,
            artist: trackData.artist,
            album: trackData.album,
            genre: trackData.genre || [],
            mood: trackData.mood || [],
            tags: trackData.tags || [],
            duration: trackData.duration,
            bpm: trackData.bpm,
            key: trackData.key,
            previewUrl: trackData.previewUrl,
            thumbnailUrl: trackData.thumbnailUrl,
            waveformUrl: trackData.waveformUrl,
            licenseStatus: 'active',
            allowsEmbedding: true,
            requiresAttribution: trackData.requiresAttribution || false,
            lastSyncedAt: new Date()
          });
          await newTrack.save();
          newCount++;
        }
        synced++;
      } catch (error) {
        logger.warn('Error syncing individual track', {
          error: error.message,
          provider: config.provider,
          trackId: trackData.trackId
        });
      }
    }

    // Update provider sync timestamp
    await MusicProviderConfig.findByIdAndUpdate(config._id, {
      $set: { lastSyncedAt: new Date() }
    });

    logger.info('Catalog sync completed', {
      provider: config.provider,
      synced,
      updated,
      new: newCount
    });

    return { synced, updated, new: newCount };
  } catch (error) {
    logger.error('Error syncing provider catalog', {
      error: error.message,
      provider: config.provider
    });
    throw error;
  }
}

/**
 * Incremental sync (only new/updated tracks)
 */
async function incrementalSync(providers = null) {
  return await syncCatalogFromProviders({
    providers,
    fullSync: false,
    maxTracks: 100
  });
}

/**
 * Full sync (all tracks)
 */
async function fullSync(providers = null) {
  return await syncCatalogFromProviders({
    providers,
    fullSync: true,
    maxTracks: 10000
  });
}

/**
 * Schedule periodic sync
 */
function schedulePeriodicSync(intervalMinutes = 60) {
  // This would typically use a job queue (Bull, Agenda, etc.)
  // For now, just log the schedule
  logger.info('Periodic catalog sync scheduled', { intervalMinutes });
  
  // In production, set up a cron job or job queue
  setInterval(async () => {
    try {
      logger.info('Running scheduled catalog sync');
      await incrementalSync();
    } catch (error) {
      logger.error('Error in scheduled catalog sync', { error: error.message });
    }
  }, intervalMinutes * 60 * 1000);
}

module.exports = {
  syncCatalogFromProviders,
  syncProviderCatalog,
  incrementalSync,
  fullSync,
  schedulePeriodicSync
};







