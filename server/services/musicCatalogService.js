// Music Catalog Service
// Unified catalog access for both licensed and AI-generated music

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const Music = require('../models/Music');
const MusicFavorite = require('../models/MusicFavorite');
const { searchTracksAcrossProviders } = require('./musicLicensingProviderService');
const { getAvailableStyles } = require('./aiMusicGenerationService');

/**
 * Search unified music catalog
 */
async function searchCatalog(query, filters, userId, options = {}) {
  const {
    includeLicensed = true,
    includeAIGenerated = true,
    includeUserUploads = true,
    limit = 50,
    offset = 0
  } = options;

  try {
    const results = {
      tracks: [],
      total: 0,
      sources: {
        licensed: 0,
        aiGenerated: 0,
        userUploads: 0
      }
    };

    // Search licensed tracks
    if (includeLicensed) {
      try {
        // First search local database
        const localTracks = await searchLicensedTracks(query, filters, userId, { limit, offset });
        results.tracks.push(...localTracks.map(track => ({
          ...track,
          source: 'licensed',
          sourceProvider: track.provider
        })));
        results.sources.licensed = localTracks.length;

        // Optionally search provider APIs for additional tracks
        // This can be done in background or on-demand
      } catch (error) {
        logger.warn('Error searching licensed tracks', { error: error.message });
      }
    }

    // Search AI-generated tracks
    if (includeAIGenerated) {
      try {
        const aiTracks = await searchAIGeneratedTracks(query, filters, userId, { limit, offset });
        results.tracks.push(...aiTracks.map(track => ({
          ...track,
          source: 'ai_generated',
          sourceProvider: track.provider
        })));
        results.sources.aiGenerated = aiTracks.length;
      } catch (error) {
        logger.warn('Error searching AI-generated tracks', { error: error.message });
      }
    }

    // Search user uploads
    if (includeUserUploads) {
      try {
        const userTracks = await searchUserUploads(query, filters, userId, { limit, offset });
        results.tracks.push(...userTracks.map(track => ({
          ...track,
          source: 'user_upload',
          sourceProvider: 'internal'
        })));
        results.sources.userUploads = userTracks.length;
      } catch (error) {
        logger.warn('Error searching user uploads', { error: error.message });
      }
    }

    // Sort and deduplicate
    results.tracks = deduplicateAndSortTracks(results.tracks);
    results.total = results.tracks.length;

    // Limit results
    results.tracks = results.tracks.slice(0, limit);

    return results;
  } catch (error) {
    logger.error('Error searching catalog', { error: error.message, query, userId });
    throw error;
  }
}

/**
 * Search licensed tracks
 */
async function searchLicensedTracks(query, filters, userId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const searchFilters = {
    licenseStatus: 'active',
    allowsEmbedding: true
  };

  if (filters.genre) searchFilters.genre = filters.genre;
  if (filters.mood) searchFilters.mood = filters.mood;

  const tracks = await MusicLicense.find(searchFilters)
    .sort({ usageCount: -1, createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  // Apply text search if query provided
  let filteredTracks = tracks;
  if (query) {
    const queryLower = query.toLowerCase();
    filteredTracks = tracks.filter(track =>
      track.title?.toLowerCase().includes(queryLower) ||
      track.artist?.toLowerCase().includes(queryLower) ||
      track.tags?.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }

  return filteredTracks.map(track => formatLicensedTrack(track, userId));
}

/**
 * Search AI-generated tracks
 */
async function searchAIGeneratedTracks(query, filters, userId, options = {}) {
  const MusicGeneration = require('../models/MusicGeneration');
  const { limit = 50, offset = 0 } = options;

  const searchFilters = {
    userId,
    status: 'completed',
    musicId: { $ne: null } // Only completed and downloaded tracks
  };

  if (filters.genre && filters.genre !== 'all') {
    searchFilters['params.genre'] = filters.genre;
  }
  if (filters.mood && filters.mood !== 'all') {
    searchFilters['params.mood'] = filters.mood;
  }

  const generations = await MusicGeneration.find(searchFilters)
    .populate('musicId')
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  // Apply text search
  let filtered = generations;
  if (query) {
    const queryLower = query.toLowerCase();
    filtered = generations.filter(gen => {
      const music = gen.musicId;
      if (!music) return false;
      return music.title?.toLowerCase().includes(queryLower) ||
             music.genre?.toLowerCase().includes(queryLower);
    });
  }

  return filtered
    .filter(gen => gen.musicId)
    .map(gen => formatAIGeneratedTrack(gen, userId));
}

/**
 * Search user uploads
 */
async function searchUserUploads(query, filters, userId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const searchFilters = { userId };
  if (filters.genre && filters.genre !== 'all') searchFilters.genre = filters.genre;
  if (filters.mood && filters.mood !== 'all') searchFilters.mood = filters.mood;

  const tracks = await Music.find(searchFilters)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  // Apply text search
  let filtered = tracks;
  if (query) {
    const queryLower = query.toLowerCase();
    filtered = tracks.filter(track =>
      track.title?.toLowerCase().includes(queryLower) ||
      track.artist?.toLowerCase().includes(queryLower)
    );
  }

  return filtered.map(track => formatUserUploadTrack(track, userId));
}

/**
 * Format licensed track for catalog
 */
function formatLicensedTrack(track, userId) {
  return {
    id: track._id.toString(),
    trackId: track.providerTrackId,
    title: track.title,
    artist: track.artist,
    album: track.album,
    genre: track.genre || [],
    mood: track.mood || [],
    tags: track.tags || [],
    duration: track.duration,
    bpm: track.bpm,
    key: track.key,
    previewUrl: track.previewUrl,
    thumbnailUrl: track.thumbnailUrl,
    waveformUrl: track.waveformUrl,
    provider: track.provider,
    source: 'licensed',
    license: {
      allowsCommercialUse: true,
      allowsSocialPlatforms: track.allowsEmbedding,
      allowsMonetization: true,
      requiresAttribution: track.requiresAttribution,
      attributionText: track.attributionText,
      platforms: ['youtube', 'tiktok', 'instagram', 'facebook', 'twitter', 'linkedin']
    },
    usageCount: track.usageCount || 0,
    lastUsedAt: track.lastUsedAt
  };
}

/**
 * Format AI-generated track for catalog
 */
function formatAIGeneratedTrack(generation, userId) {
  const music = generation.musicId;
  if (!music) return null;

  return {
    id: music._id.toString(),
    trackId: generation.trackId,
    title: music.title,
    artist: music.artist || `${generation.provider} AI`,
    genre: [music.genre],
    mood: [music.mood],
    tags: [],
    duration: music.file?.duration || generation.params?.duration || 60,
    bpm: generation.params?.bpm,
    previewUrl: music.file?.url,
    thumbnailUrl: null,
    waveformUrl: null,
    provider: generation.provider,
    source: 'ai_generated',
    license: {
      allowsCommercialUse: true,
      allowsSocialPlatforms: true,
      allowsMonetization: true,
      requiresAttribution: false,
      attributionText: null,
      platforms: ['all']
    },
    generationParams: generation.params
  };
}

/**
 * Format user upload track for catalog
 */
function formatUserUploadTrack(track, userId) {
  return {
    id: track._id.toString(),
    trackId: null,
    title: track.title,
    artist: track.artist,
    album: null,
    genre: [track.genre],
    mood: [track.mood],
    tags: track.tags || [],
    duration: track.file?.duration,
    bpm: null,
    previewUrl: track.file?.url,
    thumbnailUrl: track.thumbnail,
    waveformUrl: null,
    provider: 'internal',
    source: 'user_upload',
    license: {
      allowsCommercialUse: track.license === 'royalty-free' || track.license === 'licensed',
      allowsSocialPlatforms: true,
      allowsMonetization: track.license === 'royalty-free' || track.license === 'licensed',
      requiresAttribution: false,
      platforms: ['all']
    },
    usageCount: track.usageCount || 0
  };
}

/**
 * Deduplicate and sort tracks
 */
function deduplicateAndSortTracks(tracks) {
  // Remove duplicates based on title + artist
  const seen = new Set();
  const unique = tracks.filter(track => {
    const key = `${track.title}_${track.artist}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by relevance (usage count, recency, etc.)
  return unique.sort((a, b) => {
    // Prioritize licensed tracks with high usage
    if (a.source === 'licensed' && b.source !== 'licensed') return -1;
    if (b.source === 'licensed' && a.source !== 'licensed') return 1;
    
    // Sort by usage count
    const usageDiff = (b.usageCount || 0) - (a.usageCount || 0);
    if (Math.abs(usageDiff) > 0) return usageDiff;
    
    return 0;
  });
}

/**
 * Get track details with full license information
 */
async function getTrackDetails(trackId, source, userId) {
  try {
    if (source === 'licensed') {
      const track = await MusicLicense.findById(trackId).lean();
      if (!track) throw new Error('Track not found');
      return formatLicensedTrack(track, userId);
    } else if (source === 'ai_generated') {
      const MusicGeneration = require('../models/MusicGeneration');
      // Try to find by musicId first, then by _id
      let generation = await MusicGeneration.findOne({
        musicId: trackId,
        userId
      }).populate('musicId').lean();
      
      if (!generation) {
        generation = await MusicGeneration.findById(trackId).populate('musicId').lean();
      }
      
      if (!generation || !generation.musicId) throw new Error('Track not found');
      return formatAIGeneratedTrack(generation, userId);
    } else if (source === 'user_upload') {
      const track = await Music.findOne({
        _id: trackId,
        userId
      }).lean();
      
      if (!track) throw new Error('Track not found');
      return formatUserUploadTrack(track, userId);
    }
    
    throw new Error('Invalid source');
  } catch (error) {
    logger.error('Error getting track details', { error: error.message, trackId, source });
    throw error;
  }
}

/**
 * Get available filters (genres, moods, etc.)
 */
async function getAvailableFilters() {
  try {
    // Get from licensed tracks
    const licensedGenres = await MusicLicense.distinct('genre');
    const licensedMoods = await MusicLicense.distinct('mood');

    // Get from AI generation styles
    const aiStyles = {
      mubert: await getAvailableStyles('mubert').catch(() => ({ moods: [], genres: [] })),
      soundraw: await getAvailableStyles('soundraw').catch(() => ({ moods: [], genres: [] }))
    };

    // Combine and deduplicate
    const allGenres = [...new Set([
      ...licensedGenres,
      ...(aiStyles.mubert.genres || []),
      ...(aiStyles.soundraw.genres || [])
    ])].filter(Boolean);

    const allMoods = [...new Set([
      ...licensedMoods,
      ...(aiStyles.mubert.moods || []),
      ...(aiStyles.soundraw.moods || [])
    ])].filter(Boolean);

    return {
      genres: allGenres.sort(),
      moods: allMoods.sort(),
      sources: ['licensed', 'ai_generated', 'user_upload']
    };
  } catch (error) {
    logger.error('Error getting available filters', { error: error.message });
    return {
      genres: [],
      moods: [],
      sources: []
    };
  }
}

module.exports = {
  searchCatalog,
  getTrackDetails,
  getAvailableFilters,
  formatLicensedTrack,
  formatAIGeneratedTrack,
  formatUserUploadTrack
};

