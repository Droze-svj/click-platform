// Music Catalog Recommendations Service
// Provides track recommendations based on usage patterns and content analysis

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicGeneration = require('../models/MusicGeneration');
const Music = require('../models/Music');
const MusicFavorite = require('../models/MusicFavorite');

/**
 * Get recommended tracks for user
 */
async function getRecommendedTracks(userId, options = {}) {
  const {
    limit = 20,
    basedOn = 'usage', // 'usage', 'favorites', 'similar', 'trending'
    excludeTrackIds = []
  } = options;

  try {
    let recommendations = [];

    switch (basedOn) {
      case 'usage':
        recommendations = await getRecommendationsBasedOnUsage(userId, limit, excludeTrackIds);
        break;
      case 'favorites':
        recommendations = await getRecommendationsBasedOnFavorites(userId, limit, excludeTrackIds);
        break;
      case 'similar':
        recommendations = await getSimilarTracks(options.trackId, limit, excludeTrackIds);
        break;
      case 'trending':
        recommendations = await getTrendingTracks(limit, excludeTrackIds);
        break;
      default:
        recommendations = await getRecommendationsBasedOnUsage(userId, limit, excludeTrackIds);
    }

    return recommendations;
  } catch (error) {
    logger.error('Error getting recommended tracks', { error: error.message, userId });
    return [];
  }
}

/**
 * Recommendations based on user's usage patterns
 */
async function getRecommendationsBasedOnUsage(userId, limit, excludeTrackIds) {
  try {
    // Get user's most used genres/moods
    const userPreferences = await getUserPreferences(userId);

    // Find tracks with similar characteristics
    const recommendations = await MusicLicense.find({
      _id: { $nin: excludeTrackIds },
      licenseStatus: 'active',
      $or: [
        { genre: { $in: userPreferences.genres } },
        { mood: { $in: userPreferences.moods } }
      ]
    })
    .sort({ usageCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();

    return recommendations.map(track => ({
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      mood: track.mood,
      source: 'licensed',
      recommendationReason: 'Based on your usage patterns'
    }));
  } catch (error) {
    logger.error('Error getting usage-based recommendations', { error: error.message });
    return [];
  }
}

/**
 * Recommendations based on user's favorites
 */
async function getRecommendationsBasedOnFavorites(userId, limit, excludeTrackIds) {
  try {
    // Get user's favorite tracks
    const favorites = await MusicFavorite.find({ userId })
      .populate('licenseId')
      .lean();

    if (favorites.length === 0) {
      return getTrendingTracks(limit, excludeTrackIds);
    }

    // Extract genres/moods from favorites
    const favoriteGenres = [];
    const favoriteMoods = [];

    favorites.forEach(fav => {
      const track = fav.licenseId;
      if (track) {
        favoriteGenres.push(...(track.genre || []));
        favoriteMoods.push(...(track.mood || []));
      }
    });

    const uniqueGenres = [...new Set(favoriteGenres)];
    const uniqueMoods = [...new Set(favoriteMoods)];

    // Find similar tracks
    const recommendations = await MusicLicense.find({
      _id: { 
        $nin: [
          ...excludeTrackIds,
          ...favorites.map(f => f.licenseId?._id?.toString()).filter(Boolean)
        ]
      },
      licenseStatus: 'active',
      $or: [
        { genre: { $in: uniqueGenres } },
        { mood: { $in: uniqueMoods } }
      ]
    })
    .sort({ usageCount: -1 })
    .limit(limit)
    .lean();

    return recommendations.map(track => ({
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      mood: track.mood,
      source: 'licensed',
      recommendationReason: 'Similar to your favorites'
    }));
  } catch (error) {
    logger.error('Error getting favorites-based recommendations', { error: error.message });
    return [];
  }
}

/**
 * Get similar tracks to a specific track
 */
async function getSimilarTracks(trackId, limit, excludeTrackIds) {
  try {
    const track = await MusicLicense.findById(trackId).lean();
    if (!track) return [];

    // Find tracks with similar genre/mood/BPM
    const recommendations = await MusicLicense.find({
      _id: { $nin: [trackId, ...excludeTrackIds] },
      licenseStatus: 'active',
      $or: [
        { genre: { $in: track.genre || [] } },
        { mood: { $in: track.mood || [] } },
        { bpm: track.bpm ? { $gte: track.bpm - 5, $lte: track.bpm + 5 } : undefined }
      ].filter(Boolean)
    })
    .limit(limit)
    .lean();

    return recommendations.map(t => ({
      id: t._id.toString(),
      title: t.title,
      artist: t.artist,
      genre: t.genre,
      mood: t.mood,
      source: 'licensed',
      recommendationReason: 'Similar track'
    }));
  } catch (error) {
    logger.error('Error getting similar tracks', { error: error.message, trackId });
    return [];
  }
}

/**
 * Get trending tracks
 */
async function getTrendingTracks(limit, excludeTrackIds) {
  try {
    // Tracks with high recent usage
    const recommendations = await MusicLicense.find({
      _id: { $nin: excludeTrackIds },
      licenseStatus: 'active',
      usageCount: { $gt: 0 }
    })
    .sort({ usageCount: -1, lastUsedAt: -1 })
    .limit(limit)
    .lean();

    return recommendations.map(track => ({
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      mood: track.mood,
      source: 'licensed',
      recommendationReason: 'Trending'
    }));
  } catch (error) {
    logger.error('Error getting trending tracks', { error: error.message });
    return [];
  }
}

/**
 * Get user preferences from usage
 */
async function getUserPreferences(userId) {
  try {
    // Get user's favorite genres/moods
    const favorites = await MusicFavorite.find({ userId })
      .populate('licenseId', 'genre mood')
      .lean();

    const genres = [];
    const moods = [];

    favorites.forEach(fav => {
      const track = fav.licenseId;
      if (track) {
        genres.push(...(track.genre || []));
        moods.push(...(track.mood || []));
      }
    });

    // Count occurrences
    const genreCounts = {};
    const moodCounts = {};

    genres.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
    moods.forEach(m => moodCounts[m] = (moodCounts[m] || 0) + 1);

    // Get top preferences
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([genre]) => genre);

    const topMoods = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([mood]) => mood);

    return {
      genres: topGenres,
      moods: topMoods
    };
  } catch (error) {
    logger.error('Error getting user preferences', { error: error.message });
    return { genres: [], moods: [] };
  }
}

/**
 * Recommend tracks for video/scene content
 */
async function recommendTracksForContent(contentMetadata, options = {}) {
  const { limit = 10 } = options;

  try {
    const { recommendMusicForVideo } = require('./aiMusicRecommendationService');
    const recommendations = recommendMusicForVideo(contentMetadata);

    // Find existing tracks matching recommendations
    const matchingTracks = await MusicLicense.find({
      licenseStatus: 'active',
      genre: recommendations.genre,
      mood: recommendations.mood,
      bpm: recommendations.bpm ? { $gte: recommendations.bpm - 5, $lte: recommendations.bpm + 5 } : undefined
    })
    .sort({ usageCount: -1 })
    .limit(limit)
    .lean();

    return {
      recommendedParams: recommendations,
      matchingTracks: matchingTracks.map(track => ({
        id: track._id.toString(),
        title: track.title,
        artist: track.artist,
        genre: track.genre,
        mood: track.mood,
        bpm: track.bpm,
        source: 'licensed',
        matchScore: calculateMatchScore(track, recommendations)
      }))
    };
  } catch (error) {
    logger.error('Error recommending tracks for content', { error: error.message });
    return { recommendedParams: null, matchingTracks: [] };
  }
}

/**
 * Calculate match score for track recommendations
 */
function calculateMatchScore(track, recommendations) {
  let score = 0;

  if (track.genre?.includes(recommendations.genre)) score += 2;
  if (track.mood?.includes(recommendations.mood)) score += 2;
  if (track.bpm && recommendations.bpm) {
    const bpmDiff = Math.abs(track.bpm - recommendations.bpm);
    if (bpmDiff <= 5) score += 2;
    else if (bpmDiff <= 10) score += 1;
  }

  return score;
}

module.exports = {
  getRecommendedTracks,
  getRecommendationsBasedOnUsage,
  getRecommendationsBasedOnFavorites,
  getSimilarTracks,
  getTrendingTracks,
  recommendTracksForContent
};







