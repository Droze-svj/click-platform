// Advanced Search Service
// AI-powered semantic search and content discovery

const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const User = require('../models/User');
const { generateSocialContent } = require('./aiService');
const logger = require('../utils/logger');

/**
 * Semantic search using AI
 */
async function semanticSearch(userId, query, options = {}) {
  try {
    const {
      limit = 20,
      platforms = null,
      contentType = null,
      dateRange = null,
      sortBy = 'relevance'
    } = options;

    // Build base query
    const mongoQuery = { userId };

    // Platform filter
    if (platforms && platforms.length > 0) {
      mongoQuery['generatedContent.socialPosts.platform'] = { $in: platforms };
    }

    // Content type filter
    if (contentType) {
      mongoQuery.type = contentType;
    }

    // Date range filter
    if (dateRange) {
      mongoQuery.createdAt = {};
      if (dateRange.start) {
        mongoQuery.createdAt.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        mongoQuery.createdAt.$lte = new Date(dateRange.end);
      }
    }

    // Get all matching content
    const allContent = await Content.find(mongoQuery)
      .limit(limit * 3) // Get more for semantic matching
      .lean();

    // Use AI to score relevance
    const scoredContent = await scoreContentRelevance(allContent, query);

    // Sort by relevance
    scoredContent.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));

    // Return top results
    return scoredContent.slice(0, limit).map(item => ({
      content: item.content,
      relevanceScore: item.relevanceScore,
      matchedFields: item.matchedFields,
      highlights: item.highlights
    }));
  } catch (error) {
    logger.error('Error in semantic search', { error: error.message, userId, query });
    // Fallback to text search
    return textSearch(userId, query, options);
  }
}

/**
 * Score content relevance using AI
 */
async function scoreContentRelevance(contentArray, query) {
  try {
    // For now, use simple text matching with weights
    // In production, use embeddings or AI service
    return contentArray.map(content => {
      const text = `${content.title || ''} ${content.description || ''} ${content.transcript || ''}`.toLowerCase();
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/);

      let score = 0;
      const matchedFields = [];
      const highlights = [];

      // Title match (highest weight)
      if (content.title) {
        const titleLower = content.title.toLowerCase();
        queryWords.forEach(word => {
          if (titleLower.includes(word)) {
            score += 10;
            if (!matchedFields.includes('title')) matchedFields.push('title');
            highlights.push({ field: 'title', text: content.title });
          }
        });
      }

      // Description match
      if (content.description) {
        const descLower = content.description.toLowerCase();
        queryWords.forEach(word => {
          if (descLower.includes(word)) {
            score += 5;
            if (!matchedFields.includes('description')) matchedFields.push('description');
          }
        });
      }

      // Transcript match
      if (content.transcript) {
        const transcriptLower = content.transcript.toLowerCase();
        queryWords.forEach(word => {
          if (transcriptLower.includes(word)) {
            score += 3;
            if (!matchedFields.includes('transcript')) matchedFields.push('transcript');
          }
        });
      }

      // Tags match
      if (content.tags && content.tags.length > 0) {
        content.tags.forEach(tag => {
          if (queryLower.includes(tag.toLowerCase()) || tag.toLowerCase().includes(queryLower)) {
            score += 7;
            if (!matchedFields.includes('tags')) matchedFields.push('tags');
          }
        });
      }

      // Exact phrase match bonus
      if (text.includes(queryLower)) {
        score += 15;
      }

      return {
        content,
        relevanceScore: score,
        matchedFields,
        highlights
      };
    });
  } catch (error) {
    logger.error('Error scoring content relevance', { error: error.message });
    return contentArray.map(content => ({
      content,
      relevanceScore: 0,
      matchedFields: [],
      highlights: []
    }));
  }
}

/**
 * Text-based search (fallback)
 */
async function textSearch(userId, query, options = {}) {
  try {
    const {
      limit = 20,
      platforms = null,
      contentType = null,
      dateRange = null
    } = options;

    const searchQuery = {
      userId,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { transcript: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ]
    };

    if (platforms && platforms.length > 0) {
      searchQuery['generatedContent.socialPosts.platform'] = { $in: platforms };
    }

    if (contentType) {
      searchQuery.type = contentType;
    }

    if (dateRange) {
      searchQuery.createdAt = {};
      if (dateRange.start) {
        searchQuery.createdAt.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        searchQuery.createdAt.$lte = new Date(dateRange.end);
      }
    }

    const results = await Content.find(searchQuery)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean();

    return results.map(content => ({
      content,
      relevanceScore: 50, // Default score for text search
      matchedFields: ['text'],
      highlights: []
    }));
  } catch (error) {
    logger.error('Error in text search', { error: error.message, userId, query });
    return [];
  }
}

/**
 * Faceted search with filters
 */
async function facetedSearch(userId, query, filters = {}) {
  try {
    const {
      platforms = [],
      contentTypes = [],
      tags = [],
      dateRange = null,
      status = [],
      minEngagement = null,
      sortBy = 'relevance',
      limit = 20
    } = filters;

    const mongoQuery = { userId };

    // Text search
    if (query) {
      mongoQuery.$or = [
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } },
        { transcript: { $regex: query, $options: 'i' } },
        { tags: { $in: [new RegExp(query, 'i')] } }
      ];
    }

    // Platform filter
    if (platforms.length > 0) {
      mongoQuery['generatedContent.socialPosts.platform'] = { $in: platforms };
    }

    // Content type filter
    if (contentTypes.length > 0) {
      mongoQuery.type = { $in: contentTypes };
    }

    // Tags filter
    if (tags.length > 0) {
      mongoQuery.tags = { $in: tags };
    }

    // Status filter
    if (status.length > 0) {
      mongoQuery.status = { $in: status };
    }

    // Date range filter
    if (dateRange) {
      mongoQuery.createdAt = {};
      if (dateRange.start) {
        mongoQuery.createdAt.$gte = new Date(dateRange.start);
      }
      if (dateRange.end) {
        mongoQuery.createdAt.$lte = new Date(dateRange.end);
      }
    }

    // Engagement filter (requires join with posts)
    let results = await Content.find(mongoQuery).lean();

    // Apply engagement filter if specified
    if (minEngagement) {
      const postIds = results.map(c => c._id);
      const posts = await ScheduledPost.find({
        userId,
        contentId: { $in: postIds },
        'analytics.engagement': { $gte: minEngagement }
      }).lean();

      const contentIdsWithEngagement = new Set(
        posts.map(p => p.contentId?.toString() || p.contentId)
      );

      results = results.filter(c => contentIdsWithEngagement.has(c._id.toString()));
    }

    // Sort results
    if (sortBy === 'date') {
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'engagement') {
      // Would need to join with posts for accurate sorting
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else {
      // Relevance sort (default)
      const scored = await scoreContentRelevance(results, query || '');
      results = scored.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .map(item => item.content);
    }

    // Get facets for filtering
    const facets = await getSearchFacets(userId, mongoQuery);

    return {
      results: results.slice(0, limit),
      facets,
      total: results.length
    };
  } catch (error) {
    logger.error('Error in faceted search', { error: error.message, userId, query });
    throw error;
  }
}

/**
 * Get search facets (available filters)
 */
async function getSearchFacets(userId, baseQuery = {}) {
  try {
    const query = { ...baseQuery, userId };

    // Wrap each distinct call in a try-catch to prevent one failure from breaking all
    const getPlatforms = async () => {
      try {
        return await ScheduledPost.distinct('platform', { userId });
      } catch (error) {
        logger.warn('Error getting platforms for facets', { error: error.message });
        return [];
      }
    };

    const getContentTypes = async () => {
      try {
        return await Content.distinct('type', query);
      } catch (error) {
        logger.warn('Error getting content types for facets', { error: error.message });
        return [];
      }
    };

    const getTags = async () => {
      try {
        return await Content.distinct('tags', query);
      } catch (error) {
        logger.warn('Error getting tags for facets', { error: error.message });
        return [];
      }
    };

    const getStatuses = async () => {
      try {
        return await Content.distinct('status', query);
      } catch (error) {
        logger.warn('Error getting statuses for facets', { error: error.message });
        return [];
      }
    };

    const [platforms, contentTypes, tags, statuses] = await Promise.all([
      getPlatforms(),
      getContentTypes(),
      getTags(),
      getStatuses()
    ]);

    return {
      platforms: (platforms || []).filter(Boolean),
      contentTypes: (contentTypes || []).filter(Boolean),
      tags: (tags || []).filter(Boolean).slice(0, 50), // Limit tags
      statuses: (statuses || []).filter(Boolean)
    };
  } catch (error) {
    logger.error('Error getting search facets', { error: error.message, userId, stack: error.stack });
    return {
      platforms: [],
      contentTypes: [],
      tags: [],
      statuses: []
    };
  }
}

/**
 * Get search suggestions/autocomplete
 */
async function getSearchSuggestions(userId, partialQuery, limit = 10) {
  try {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    const query = partialQuery.toLowerCase();

    // Get matching titles
    const matchingTitles = await Content.find({
      userId,
      title: { $regex: query, $options: 'i' }
    })
      .select('title')
      .limit(limit)
      .lean();

    // Get matching tags
    const matchingTags = await Content.find({
      userId,
      tags: { $regex: query, $options: 'i' }
    })
      .select('tags')
      .limit(limit)
      .lean();

    const suggestions = new Set();

    // Add title suggestions
    matchingTitles.forEach(content => {
      if (content.title) {
        suggestions.add(content.title);
      }
    });

    // Add tag suggestions
    matchingTags.forEach(content => {
      if (content.tags && Array.isArray(content.tags)) {
        content.tags.forEach(tag => {
          if (tag.toLowerCase().includes(query)) {
            suggestions.add(tag);
          }
        });
      }
    });

    return Array.from(suggestions).slice(0, limit).map(suggestion => ({
      text: suggestion,
      type: 'suggestion'
    }));
  } catch (error) {
    logger.error('Error getting search suggestions', { error: error.message, userId });
    return [];
  }
}

/**
 * Get content discovery recommendations
 */
async function getDiscoveryRecommendations(userId, options = {}) {
  try {
    const {
      limit = 10,
      basedOn = 'performance', // performance, similarity, trending, recent
      excludeIds = []
    } = options;

    let recommendations = [];

    if (basedOn === 'performance') {
      // Get high-performing content
      const posts = await ScheduledPost.find({
        userId,
        status: 'posted',
        'analytics.engagement': { $gte: 100 }
      })
        .populate('contentId')
        .sort({ 'analytics.engagement': -1 })
        .limit(limit * 2)
        .lean();

      recommendations = posts
        .filter(p => p.contentId && !excludeIds.includes(p.contentId._id.toString()))
        .slice(0, limit)
        .map(p => ({
          content: p.contentId,
          reason: 'High performance',
          score: p.analytics?.engagement || 0
        }));
    } else if (basedOn === 'similarity') {
      // Get similar content (by tags/category)
      const userContent = await Content.findOne({ userId }).lean();
      if (userContent) {
        const similarQuery = {
          userId,
          _id: { $nin: excludeIds },
          $or: []
        };

        if (userContent.tags && userContent.tags.length > 0) {
          similarQuery.$or.push({ tags: { $in: userContent.tags } });
        }
        if (userContent.category) {
          similarQuery.$or.push({ category: userContent.category });
        }
        if (userContent.type) {
          similarQuery.$or.push({ type: userContent.type });
        }

        if (similarQuery.$or.length > 0) {
          const similar = await Content.find(similarQuery)
            .limit(limit)
            .lean();

          recommendations = similar.map(c => ({
            content: c,
            reason: 'Similar content',
            score: 75
          }));
        }
      }
    } else if (basedOn === 'trending') {
      // Get recently popular content
      const recentPosts = await ScheduledPost.find({
        userId,
        status: 'posted',
        postedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
      })
        .populate('contentId')
        .sort({ 'analytics.engagement': -1 })
        .limit(limit)
        .lean();

      recommendations = recentPosts
        .filter(p => p.contentId && !excludeIds.includes(p.contentId._id.toString()))
        .map(p => ({
          content: p.contentId,
          reason: 'Trending',
          score: p.analytics?.engagement || 0
        }));
    } else {
      // Recent content
      const recent = await Content.find({
        userId,
        _id: { $nin: excludeIds }
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      recommendations = recent.map(c => ({
        content: c,
        reason: 'Recently created',
        score: 50
      }));
    }

    return recommendations;
  } catch (error) {
    logger.error('Error getting discovery recommendations', { error: error.message, userId });
    return [];
  }
}

/**
 * Save search query
 */
async function saveSearch(userId, searchData) {
  try {
    const SavedSearch = require('../models/SavedSearch');
    const savedSearch = new SavedSearch({
      userId,
      query: searchData.query,
      filters: searchData.filters || {},
      name: searchData.name || searchData.query,
      createdAt: new Date()
    });

    await savedSearch.save();
    return savedSearch;
  } catch (error) {
    logger.error('Error saving search', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get saved searches
 */
async function getSavedSearches(userId) {
  try {
    const SavedSearch = require('../models/SavedSearch');
    if (!SavedSearch) {
      logger.warn('SavedSearch model not found');
      return [];
    }
    const searches = await SavedSearch.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return searches || [];
  } catch (error) {
    logger.error('Error getting saved searches', { error: error.message, userId, stack: error.stack });
    return [];
  }
}

/**
 * Get search analytics
 */
async function getSearchAnalytics(userId, period = 30) {
  try {
    const SearchHistory = require('../models/SearchHistory');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const searches = await SearchHistory.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const analytics = {
      totalSearches: searches.length,
      uniqueQueries: new Set(searches.map(s => s.query)).size,
      topQueries: [],
      topFilters: {},
      searchTrends: [],
      averageResultsPerSearch: 0
    };

    // Top queries
    const queryCounts = {};
    searches.forEach(search => {
      queryCounts[search.query] = (queryCounts[search.query] || 0) + 1;
    });

    analytics.topQueries = Object.entries(queryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    // Top filters
    searches.forEach(search => {
      if (search.filters) {
        Object.keys(search.filters).forEach(filter => {
          if (!analytics.topFilters[filter]) {
            analytics.topFilters[filter] = {};
          }
          const value = search.filters[filter];
          if (Array.isArray(value)) {
            value.forEach(v => {
              analytics.topFilters[filter][v] = (analytics.topFilters[filter][v] || 0) + 1;
            });
          } else {
            analytics.topFilters[filter][value] = (analytics.topFilters[filter][value] || 0) + 1;
          }
        });
      }
    });

    // Average results
    const withResults = searches.filter(s => s.resultCount);
    if (withResults.length > 0) {
      analytics.averageResultsPerSearch = Math.round(
        withResults.reduce((sum, s) => sum + (s.resultCount || 0), 0) / withResults.length
      );
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting search analytics', { error: error.message, userId });
    return {
      totalSearches: 0,
      uniqueQueries: 0,
      topQueries: [],
      topFilters: {},
      searchTrends: [],
      averageResultsPerSearch: 0
    };
  }
}

/**
 * Cluster search results by similarity
 */
async function clusterSearchResults(results, maxClusters = 5) {
  try {
    if (results.length === 0) {
      return { clusters: [], unclustered: [] };
    }

    // Simple clustering by tags and category
    const clusters = [];
    const unclustered = [];
    const processed = new Set();

    results.forEach((result, idx) => {
      if (processed.has(idx)) return;

      const content = result.content || result;
      const cluster = {
        id: clusters.length,
        label: content.category || content.tags?.[0] || 'Other',
        items: [result],
        commonTags: content.tags || [],
        commonCategory: content.category
      };

      // Find similar items
      results.forEach((otherResult, otherIdx) => {
        if (idx === otherIdx || processed.has(otherIdx)) return;

        const otherContent = otherResult.content || otherResult;
        
        // Check similarity (shared tags or category)
        const sharedTags = (content.tags || []).filter(tag => 
          (otherContent.tags || []).includes(tag)
        );
        const sameCategory = content.category && 
          content.category === otherContent.category;

        if (sharedTags.length > 0 || sameCategory) {
          cluster.items.push(otherResult);
          processed.add(otherIdx);
          // Merge tags
          cluster.commonTags = [...new Set([...cluster.commonTags, ...(otherContent.tags || [])])];
        }
      });

      if (cluster.items.length > 1) {
        clusters.push(cluster);
        processed.add(idx);
      } else {
        unclustered.push(result);
      }
    });

    // Limit clusters
    const sortedClusters = clusters.sort((a, b) => b.items.length - a.items.length);
    return {
      clusters: sortedClusters.slice(0, maxClusters),
      unclustered: unclustered.slice(0, 10)
    };
  } catch (error) {
    logger.error('Error clustering search results', { error: error.message });
    return { clusters: [], unclustered: results };
  }
}

/**
 * Track search result click
 */
async function trackSearchClick(userId, searchId, contentId, position, query = '') {
  try {
    const SearchClick = require('../models/SearchClick');
    await SearchClick.create({
      userId,
      searchId,
      contentId,
      position,
      query,
      clickedAt: new Date()
    });
  } catch (error) {
    logger.error('Error tracking search click', { error: error.message });
  }
}

/**
 * Get search result preview
 */
async function getSearchResultPreview(contentId, userId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    })
      .populate('folderId', 'name color')
      .lean();

    if (!content) {
      return null;
    }

    // Get related posts for engagement data
    const posts = await ScheduledPost.find({
      userId,
      contentId: content._id
    })
      .select('platform analytics')
      .lean();

    const totalEngagement = posts.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0);
    const platformCount = new Set(posts.map(p => p.platform)).size;

    return {
      content: {
        id: content._id,
        title: content.title,
        description: content.description,
        type: content.type,
        status: content.status,
        tags: content.tags,
        category: content.category,
        folder: content.folderId,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt
      },
      stats: {
        totalPosts: posts.length,
        totalEngagement,
        platformCount,
        averageEngagement: posts.length > 0 ? Math.round(totalEngagement / posts.length) : 0
      },
      quickActions: {
        canEdit: content.status !== 'published',
        canDuplicate: true,
        canDelete: true,
        canSchedule: content.status === 'completed'
      }
    };
  } catch (error) {
    logger.error('Error getting search result preview', { error: error.message, contentId });
    return null;
  }
}

module.exports = {
  semanticSearch,
  textSearch,
  facetedSearch,
  getSearchFacets,
  getSearchSuggestions,
  getDiscoveryRecommendations,
  saveSearch,
  getSavedSearches,
  getSearchAnalytics,
  clusterSearchResults,
  trackSearchClick,
  getSearchResultPreview
};
