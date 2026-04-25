// Advanced search engine

const Content = require('../models/Content');
const Script = require('../models/Script');
const logger = require('./logger');

/**
 * Advanced search with filters
 */
async function advancedSearch(userId, searchParams) {
  try {
    const {
      query,
      type,
      status,
      category,
      tags,
      folderId,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = searchParams;

    const searchQuery = { userId };

    // Text search
    if (query) {
      searchQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { transcript: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    // Filters
    if (type) searchQuery.type = type;
    if (status) searchQuery.status = status;
    if (category) searchQuery.category = category;
    if (tags && tags.length > 0) {
      searchQuery.tags = { $in: tags };
    }
    if (folderId) {
      if (folderId === 'null' || folderId === '') {
        searchQuery.folderId = null;
      } else {
        searchQuery.folderId = folderId;
      }
    }

    // Date range
    if (dateFrom || dateTo) {
      searchQuery.createdAt = {};
      if (dateFrom) searchQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) searchQuery.createdAt.$lte = new Date(dateTo);
    }

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const [results, total] = await Promise.all([
      Content.find(searchQuery)
        .sort(sort)
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .populate('folderId', 'name color')
        .lean(),
      Content.countDocuments(searchQuery)
    ]);

    return {
      results,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
  } catch (error) {
    logger.error('Error in advanced search', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get search suggestions (autocomplete)
 */
async function getSearchSuggestions(userId, query, limit = 10) {
  try {
    if (!query || query.length < 2) {
      return [];
    }

    const suggestions = await Content.aggregate([
      {
        $match: {
          userId: require('mongoose').Types.ObjectId(userId),
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
          ]
        }
      },
      {
        $project: {
          title: 1,
          type: 1,
          _id: 1
        }
      },
      { $limit: limit }
    ]);

    return suggestions;
  } catch (error) {
    logger.error('Error getting search suggestions', { error: error.message, userId });
    return [];
  }
}

/**
 * Get similar content
 */
async function getSimilarContent(contentId, userId, limit = 5) {
  try {
    const content = await Content.findById(contentId);
    if (!content) {
      return [];
    }

    const similarQuery = {
      userId,
      _id: { $ne: contentId },
      $or: []
    };

    // Match by tags
    if (content.tags && content.tags.length > 0) {
      similarQuery.$or.push({ tags: { $in: content.tags } });
    }

    // Match by category
    if (content.category) {
      similarQuery.$or.push({ category: content.category });
    }

    // Match by type
    similarQuery.$or.push({ type: content.type });

    if (similarQuery.$or.length === 0) {
      return [];
    }

    const similar = await Content.find(similarQuery)
      .limit(limit)
      .select('title type category tags')
      .lean();

    return similar;
  } catch (error) {
    logger.error('Error getting similar content', { error: error.message, contentId });
    return [];
  }
}

module.exports = {
  advancedSearch,
  getSearchSuggestions,
  getSimilarContent
};
