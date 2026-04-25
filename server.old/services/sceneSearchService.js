// Scene Search and Filtering Service

const Scene = require('../models/Scene');
const logger = require('../utils/logger');

/**
 * Search and filter scenes with advanced querying
 */
async function searchScenes(query, options = {}) {
  try {
    const {
      userId,
      contentId = null,
      filters = {},
      sortBy = 'sceneIndex',
      order = 'asc',
      limit = 50,
      offset = 0
    } = options;

    // Build MongoDB query
    const mongoQuery = { userId };

    if (contentId) {
      mongoQuery.contentId = contentId;
    }

    // Text search in notes or metadata
    if (query && query.trim()) {
      mongoQuery.$or = [
        { notes: { $regex: query, $options: 'i' } },
        { 'metadata.label': { $regex: query, $options: 'i' } },
        { customTags: { $regex: query, $options: 'i' } }
      ];
    }

    // Apply filters
    if (filters.isHighlight !== undefined) {
      mongoQuery.isHighlight = filters.isHighlight;
    }

    if (filters.isPromoted !== undefined) {
      mongoQuery.isPromoted = filters.isPromoted;
    }

    if (filters.isKeyMoment !== undefined) {
      mongoQuery.isKeyMoment = filters.isKeyMoment;
    }

    if (filters.hasFaces !== undefined) {
      mongoQuery['metadata.hasFaces'] = filters.hasFaces;
    }

    if (filters.hasSpeech !== undefined) {
      mongoQuery['metadata.hasSpeech'] = filters.hasSpeech;
    }

    if (filters.minDuration) {
      mongoQuery.duration = { ...mongoQuery.duration, $gte: filters.minDuration };
    }

    if (filters.maxDuration) {
      mongoQuery.duration = { ...mongoQuery.duration, $lte: filters.maxDuration };
    }

    if (filters.startTime) {
      mongoQuery.start = { ...mongoQuery.start, $gte: filters.startTime };
    }

    if (filters.endTime) {
      mongoQuery.end = { ...mongoQuery.end, $lte: filters.endTime };
    }

    if (filters.labels && filters.labels.length > 0) {
      mongoQuery['metadata.label'] = { $in: filters.labels };
    }

    if (filters.tags && filters.tags.length > 0) {
      mongoQuery.$or = [
        ...(mongoQuery.$or || []),
        { 'metadata.tags': { $in: filters.tags } },
        { customTags: { $in: filters.tags } }
      ];
    }

    if (filters.minConfidence) {
      mongoQuery.confidence = { ...mongoQuery.confidence, $gte: filters.minConfidence };
    }

    // Build sort
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;

    // Execute query
    const scenes = await Scene.find(mongoQuery)
      .sort(sort)
      .limit(limit)
      .skip(offset)
      .lean();

    const total = await Scene.countDocuments(mongoQuery);

    return {
      scenes,
      total,
      limit,
      offset,
      hasMore: offset + scenes.length < total
    };
  } catch (error) {
    logger.error('Error searching scenes', { error: error.message, query, options });
    throw error;
  }
}

/**
 * Get scenes by content with filtering
 */
async function getScenesByContent(contentId, userId, filters = {}) {
  return await searchScenes('', {
    userId,
    contentId,
    filters
  });
}

/**
 * Get scenes by tags
 */
async function getScenesByTags(tags, userId, options = {}) {
  return await searchScenes('', {
    userId,
    filters: { tags },
    ...options
  });
}

/**
 * Get scenes in time range
 */
async function getScenesInTimeRange(contentId, startTime, endTime, userId) {
  return await searchScenes('', {
    userId,
    contentId,
    filters: {
      startTime,
      endTime
    }
  });
}

/**
 * Get scene statistics
 */
async function getSceneStatistics(contentId, userId) {
  try {
    const scenes = await Scene.find({ contentId, userId }).lean();

    const stats = {
      total: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + (s.duration || 0), 0),
      averageDuration: 0,
      byLabel: {},
      byTag: {},
      highlights: 0,
      keyMoments: 0,
      withSpeech: 0,
      withFaces: 0,
      durationDistribution: {
        under10s: 0,
        under30s: 0,
        under60s: 0,
        over60s: 0
      }
    };

    if (scenes.length > 0) {
      stats.averageDuration = stats.totalDuration / scenes.length;

      scenes.forEach(scene => {
        // By label
        const label = scene.metadata?.label || 'unknown';
        stats.byLabel[label] = (stats.byLabel[label] || 0) + 1;

        // By tags
        if (scene.metadata?.tags) {
          scene.metadata.tags.forEach(tag => {
            stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
          });
        }

        // Counts
        if (scene.isHighlight || scene.isPromoted) stats.highlights++;
        if (scene.isKeyMoment) stats.keyMoments++;
        if (scene.metadata?.hasSpeech) stats.withSpeech++;
        if (scene.metadata?.hasFaces) stats.withFaces++;

        // Duration distribution
        const duration = scene.duration || 0;
        if (duration < 10) stats.durationDistribution.under10s++;
        else if (duration < 30) stats.durationDistribution.under30s++;
        else if (duration < 60) stats.durationDistribution.under60s++;
        else stats.durationDistribution.over60s++;
      });
    }

    return stats;
  } catch (error) {
    logger.error('Error getting scene statistics', { error: error.message, contentId });
    throw error;
  }
}

module.exports = {
  searchScenes,
  getScenesByContent,
  getScenesByTags,
  getScenesInTimeRange,
  getSceneStatistics
};







