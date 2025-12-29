// Advanced Music Catalog Search Service
// Enhanced search with autocomplete, suggestions, and fuzzy matching

const logger = require('../utils/logger');
const MusicLicense = require('../models/MusicLicense');
const Music = require('../models/Music');
const MusicGeneration = require('../models/MusicGeneration');

/**
 * Search autocomplete suggestions
 */
async function getSearchSuggestions(query, userId, options = {}) {
  const { limit = 10, sources = ['licensed', 'ai_generated', 'user_upload'] } = options;

  try {
    if (!query || query.length < 2) {
      return {
        tracks: [],
        artists: [],
        genres: [],
        moods: []
      };
    }

    const queryLower = query.toLowerCase();
    const suggestions = {
      tracks: [],
      artists: [],
      genres: [],
      moods: []
    };

    // Search tracks (title, artist)
    if (sources.includes('licensed')) {
      const licensedTracks = await MusicLicense.find({
        $or: [
          { title: { $regex: queryLower, $options: 'i' } },
          { artist: { $regex: queryLower, $options: 'i' } }
        ],
        licenseStatus: 'active'
      })
      .select('title artist genre mood')
      .limit(limit)
      .lean();

      suggestions.tracks.push(...licensedTracks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        artist: t.artist,
        source: 'licensed'
      })));

      // Extract unique artists, genres, moods
      const artists = [...new Set(licensedTracks.map(t => t.artist).filter(Boolean))];
      const genres = [...new Set(licensedTracks.flatMap(t => t.genre || []))];
      const moods = [...new Set(licensedTracks.flatMap(t => t.mood || []))];

      suggestions.artists.push(...artists.map(a => ({ name: a, source: 'licensed' })));
      suggestions.genres.push(...genres.map(g => ({ name: g, source: 'licensed' })));
      suggestions.moods.push(...moods.map(m => ({ name: m, source: 'licensed' })));
    }

    // Search AI-generated tracks
    if (sources.includes('ai_generated')) {
      const aiGenerations = await MusicGeneration.find({
        userId,
        status: 'completed',
        musicId: { $ne: null }
      })
      .populate('musicId', 'title artist genre mood')
      .limit(limit)
      .lean();

      const aiTracks = aiGenerations
        .filter(g => g.musicId)
        .filter(g => 
          g.musicId.title?.toLowerCase().includes(queryLower) ||
          g.musicId.artist?.toLowerCase().includes(queryLower)
        );

      suggestions.tracks.push(...aiTracks.map(g => ({
        id: g.musicId._id.toString(),
        title: g.musicId.title,
        artist: g.musicId.artist,
        source: 'ai_generated'
      })));
    }

    // Search user uploads
    if (sources.includes('user_upload')) {
      const userTracks = await Music.find({
        userId,
        $or: [
          { title: { $regex: queryLower, $options: 'i' } },
          { artist: { $regex: queryLower, $options: 'i' } }
        ]
      })
      .select('title artist genre mood')
      .limit(limit)
      .lean();

      suggestions.tracks.push(...userTracks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        artist: t.artist,
        source: 'user_upload'
      })));
    }

    // Deduplicate and limit
    suggestions.tracks = deduplicateSuggestions(suggestions.tracks).slice(0, limit);
    suggestions.artists = deduplicateSuggestions(suggestions.artists).slice(0, 5);
    suggestions.genres = deduplicateSuggestions(suggestions.genres).slice(0, 5);
    suggestions.moods = deduplicateSuggestions(suggestions.moods).slice(0, 5);

    return suggestions;
  } catch (error) {
    logger.error('Error getting search suggestions', { error: error.message, query });
    return {
      tracks: [],
      artists: [],
      genres: [],
      moods: []
    };
  }
}

/**
 * Deduplicate suggestions
 */
function deduplicateSuggestions(suggestions) {
  const seen = new Set();
  return suggestions.filter(item => {
    const key = item.title || item.name || item.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Get popular search terms
 */
async function getPopularSearchTerms(limit = 10) {
  try {
    // This would typically come from analytics/logs
    // For now, return popular genres/moods
    const popularGenres = await MusicLicense.aggregate([
      { $match: { licenseStatus: 'active' } },
      { $unwind: '$genre' },
      { $group: { _id: '$genre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    const popularMoods = await MusicLicense.aggregate([
      { $match: { licenseStatus: 'active' } },
      { $unwind: '$mood' },
      { $group: { _id: '$mood', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);

    return {
      genres: popularGenres.map(g => ({ term: g._id, count: g.count })),
      moods: popularMoods.map(m => ({ term: m._id, count: m.count }))
    };
  } catch (error) {
    logger.error('Error getting popular search terms', { error: error.message });
    return { genres: [], moods: [] };
  }
}

/**
 * Advanced search with relevance scoring
 */
async function advancedSearch(query, filters, userId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  try {
    // Build search query with relevance scoring
    const searchQuery = buildAdvancedSearchQuery(query, filters);

    // Search licensed tracks
    const licensedResults = await MusicLicense.aggregate([
      { $match: searchQuery.licensed },
      {
        $addFields: {
          relevanceScore: calculateRelevanceScore('$title', '$artist', '$tags', query)
        }
      },
      { $sort: { relevanceScore: -1, usageCount: -1 } },
      { $skip: offset },
      { $limit: limit }
    ]);

    // Similar aggregation for other sources...

    return {
      tracks: licensedResults.map(formatTrackWithScore),
      total: licensedResults.length
    };
  } catch (error) {
    logger.error('Error in advanced search', { error: error.message, query });
    throw error;
  }
}

/**
 * Build advanced search query
 */
function buildAdvancedSearchQuery(query, filters) {
  const baseQuery = {
    licenseStatus: 'active'
  };

  if (query) {
    baseQuery.$or = [
      { title: { $regex: query, $options: 'i' } },
      { artist: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ];
  }

  if (filters.genre) baseQuery.genre = filters.genre;
  if (filters.mood) baseQuery.mood = filters.mood;
  if (filters.bpm) baseQuery.bpm = filters.bpm;

  return { licensed: baseQuery };
}

/**
 * Calculate relevance score
 */
function calculateRelevanceScore(titleField, artistField, tagsField, query) {
  // Simplified relevance calculation
  // In production, use MongoDB text search or external search engine
  return { $literal: 1 };
}

/**
 * Format track with relevance score
 */
function formatTrackWithScore(track) {
  return {
    ...track,
    relevanceScore: track.relevanceScore || 0
  };
}

module.exports = {
  getSearchSuggestions,
  getPopularSearchTerms,
  advancedSearch
};







