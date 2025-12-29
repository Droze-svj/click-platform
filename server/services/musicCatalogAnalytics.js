// Music Catalog Analytics Service
// Tracks usage patterns, popular tracks, and statistics

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const MusicFavorite = require('../models/MusicFavorite');
const Music = require('../models/Music');

/**
 * Track usage of a catalog track
 */
async function trackUsage(trackId, source, userId, context = {}) {
  try {
    if (source === 'licensed') {
      await MusicLicense.findByIdAndUpdate(trackId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() }
      });
    } else if (source === 'ai_generated' || source === 'user_upload') {
      await Music.findByIdAndUpdate(trackId, {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() }
      });
    }

    // Log usage event (could be stored in analytics database)
    logger.info('Catalog track usage tracked', {
      trackId,
      source,
      userId,
      context
    });
  } catch (error) {
    logger.error('Error tracking catalog usage', {
      error: error.message,
      trackId,
      source,
      userId
    });
  }
}

/**
 * Get popular tracks
 */
async function getPopularTracks(options = {}) {
  const {
    limit = 20,
    timeRange = 'all', // 'all', 'day', 'week', 'month', 'year'
    source = null, // null = all sources
    genre = null,
    mood = null
  } = options;

  try {
    const matchStage = {
      licenseStatus: 'active'
    };

    if (genre) matchStage.genre = genre;
    if (mood) matchStage.mood = mood;

    if (timeRange !== 'all') {
      const timeRanges = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      matchStage.lastUsedAt = {
        $gte: new Date(Date.now() - timeRanges[timeRange])
      };
    }

    const popularTracks = await MusicLicense.aggregate([
      { $match: matchStage },
      { $sort: { usageCount: -1, lastUsedAt: -1 } },
      { $limit: limit }
    ]);

    return popularTracks.map(track => ({
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      mood: track.mood,
      usageCount: track.usageCount || 0,
      lastUsedAt: track.lastUsedAt,
      source: 'licensed'
    }));
  } catch (error) {
    logger.error('Error getting popular tracks', { error: error.message });
    return [];
  }
}

/**
 * Get trending tracks (recently popular)
 */
async function getTrendingTracks(limit = 20) {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trendingTracks = await MusicLicense.aggregate([
      {
        $match: {
          licenseStatus: 'active',
          lastUsedAt: { $gte: weekAgo }
        }
      },
      {
        $addFields: {
          trendingScore: {
            $divide: [
              { $ifNull: ['$usageCount', 0] },
              {
                $max: [
                  1,
                  {
                    $divide: [
                      { $subtract: [new Date(), { $ifNull: ['$lastUsedAt', new Date()] }] },
                      1000 * 60 * 60 * 24 // Convert to days
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      { $sort: { trendingScore: -1, lastUsedAt: -1 } },
      { $limit: limit }
    ]);

    return trendingTracks.map(track => ({
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      genre: track.genre,
      mood: track.mood,
      usageCount: track.usageCount || 0,
      trendingScore: track.trendingScore,
      source: 'licensed'
    }));
  } catch (error) {
    logger.error('Error getting trending tracks', { error: error.message });
    return [];
  }
}

/**
 * Get catalog statistics
 */
async function getCatalogStatistics() {
  try {
    const stats = {
      totalTracks: await MusicLicense.countDocuments({ licenseStatus: 'active' }),
      totalGenres: await MusicLicense.distinct('genre').then(g => g.length),
      totalMoods: await MusicLicense.distinct('mood').then(m => m.length),
      totalFavorites: await MusicFavorite.countDocuments(),
      mostUsedGenre: await getMostUsedGenre(),
      mostUsedMood: await getMostUsedMood(),
      topArtists: await getTopArtists(10),
      totalUsageCount: await MusicLicense.aggregate([
        { $match: { licenseStatus: 'active' } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$usageCount', 0] } } } }
      ]).then(result => result[0]?.total || 0)
    };

    return stats;
  } catch (error) {
    logger.error('Error getting catalog statistics', { error: error.message });
    return null;
  }
}

/**
 * Get most used genre
 */
async function getMostUsedGenre() {
  try {
    const result = await MusicLicense.aggregate([
      { $match: { licenseStatus: 'active' } },
      { $unwind: '$genre' },
      {
        $group: {
          _id: '$genre',
          totalUsage: { $sum: { $ifNull: ['$usageCount', 0] } },
          trackCount: { $sum: 1 }
        }
      },
      { $sort: { totalUsage: -1 } },
      { $limit: 1 }
    ]);

    return result[0] || null;
  } catch (error) {
    logger.error('Error getting most used genre', { error: error.message });
    return null;
  }
}

/**
 * Get most used mood
 */
async function getMostUsedMood() {
  try {
    const result = await MusicLicense.aggregate([
      { $match: { licenseStatus: 'active' } },
      { $unwind: '$mood' },
      {
        $group: {
          _id: '$mood',
          totalUsage: { $sum: { $ifNull: ['$usageCount', 0] } },
          trackCount: { $sum: 1 }
        }
      },
      { $sort: { totalUsage: -1 } },
      { $limit: 1 }
    ]);

    return result[0] || null;
  } catch (error) {
    logger.error('Error getting most used mood', { error: error.message });
    return null;
  }
}

/**
 * Get top artists
 */
async function getTopArtists(limit = 10) {
  try {
    const artists = await MusicLicense.aggregate([
      { $match: { licenseStatus: 'active', artist: { $ne: null } } },
      {
        $group: {
          _id: '$artist',
          totalUsage: { $sum: { $ifNull: ['$usageCount', 0] } },
          trackCount: { $sum: 1 }
        }
      },
      { $sort: { totalUsage: -1 } },
      { $limit: limit }
    ]);

    return artists.map(a => ({
      name: a._id,
      totalUsage: a.totalUsage,
      trackCount: a.trackCount
    }));
  } catch (error) {
    logger.error('Error getting top artists', { error: error.message });
    return [];
  }
}

/**
 * Get user statistics
 */
async function getUserStatistics(userId) {
  try {
    const stats = {
      favoritesCount: await MusicFavorite.countDocuments({ userId }),
      usedTracksCount: await MusicLicense.countDocuments({
        lastUsedBy: userId
      }),
      topGenres: await getUserTopGenres(userId),
      topMoods: await getUserTopMoods(userId)
    };

    return stats;
  } catch (error) {
    logger.error('Error getting user statistics', { error: error.message, userId });
    return null;
  }
}

/**
 * Get user's top genres
 */
async function getUserTopGenres(userId, limit = 5) {
  try {
    const favorites = await MusicFavorite.find({ userId })
      .populate('licenseId', 'genre')
      .lean();

    const genreCounts = {};
    favorites.forEach(fav => {
      const track = fav.licenseId;
      if (track && track.genre) {
        track.genre.forEach(g => {
          genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    });

    return Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([genre, count]) => ({ genre, count }));
  } catch (error) {
    logger.error('Error getting user top genres', { error: error.message });
    return [];
  }
}

/**
 * Get user's top moods
 */
async function getUserTopMoods(userId, limit = 5) {
  try {
    const favorites = await MusicFavorite.find({ userId })
      .populate('licenseId', 'mood')
      .lean();

    const moodCounts = {};
    favorites.forEach(fav => {
      const track = fav.licenseId;
      if (track && track.mood) {
        track.mood.forEach(m => {
          moodCounts[m] = (moodCounts[m] || 0) + 1;
        });
      }
    });

    return Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([mood, count]) => ({ mood, count }));
  } catch (error) {
    logger.error('Error getting user top moods', { error: error.message });
    return [];
  }
}

module.exports = {
  trackUsage,
  getPopularTracks,
  getTrendingTracks,
  getCatalogStatistics,
  getUserStatistics
};







