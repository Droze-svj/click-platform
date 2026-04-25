// Elasticsearch Service (with graceful fallback)

const logger = require('../utils/logger');
const { get, set } = require('./cacheService');

let elasticsearchClient = null;
let isElasticsearchEnabled = false;

/**
 * Initialize Elasticsearch client
 */
async function initElasticsearch() {
  try {
    const { Client } = require('@elastic/elasticsearch');
    
    const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    const esApiKey = process.env.ELASTICSEARCH_API_KEY;
    const esUsername = process.env.ELASTICSEARCH_USERNAME;
    const esPassword = process.env.ELASTICSEARCH_PASSWORD;

    const clientConfig = {
      node: esUrl,
    };

    if (esApiKey) {
      clientConfig.auth = {
        apiKey: esApiKey,
      };
    } else if (esUsername && esPassword) {
      clientConfig.auth = {
        username: esUsername,
        password: esPassword,
      };
    }

    elasticsearchClient = new Client(clientConfig);

    // Test connection
    const health = await elasticsearchClient.cluster.health();
    logger.info('Elasticsearch connected', { status: health.status });

    // Create indices if they don't exist
    await createIndices();

    isElasticsearchEnabled = true;
    logger.info('✅ Elasticsearch initialized');
  } catch (error) {
    logger.warn('Elasticsearch not available, using MongoDB search', {
      error: error.message,
    });
    isElasticsearchEnabled = false;
    // Graceful degradation - continue without Elasticsearch
  }
}

/**
 * Create Elasticsearch indices
 */
async function createIndices() {
  if (!elasticsearchClient) return;

  const indices = [
    {
      index: 'content',
      body: {
        mappings: {
          properties: {
            userId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            description: { type: 'text', analyzer: 'standard' },
            transcript: { type: 'text', analyzer: 'standard' },
            type: { type: 'keyword' },
            status: { type: 'keyword' },
            tags: { type: 'keyword' },
            category: { type: 'keyword' },
            createdAt: { type: 'date' },
            updatedAt: { type: 'date' },
          },
        },
      },
    },
    {
      index: 'scripts',
      body: {
        mappings: {
          properties: {
            userId: { type: 'keyword' },
            title: { type: 'text', analyzer: 'standard' },
            content: { type: 'text', analyzer: 'standard' },
            type: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      },
    },
  ];

  for (const indexConfig of indices) {
    try {
      const exists = await elasticsearchClient.indices.exists({
        index: indexConfig.index,
      });

      if (!exists) {
        await elasticsearchClient.indices.create(indexConfig);
        logger.info('Elasticsearch index created', { index: indexConfig.index });
      }
    } catch (error) {
      logger.error('Error creating index', {
        index: indexConfig.index,
        error: error.message,
      });
    }
  }
}

/**
 * Index a document
 */
async function indexDocument(index, id, document) {
  if (!isElasticsearchEnabled || !elasticsearchClient) {
    return false;
  }

  try {
    await elasticsearchClient.index({
      index,
      id,
      body: document,
    });
    return true;
  } catch (error) {
    logger.error('Error indexing document', {
      index,
      id,
      error: error.message,
    });
    return false;
  }
}

/**
 * Search documents
 */
async function search(index, query, options = {}) {
  if (!isElasticsearchEnabled || !elasticsearchClient) {
    // Fallback to MongoDB search
    return null;
  }

  try {
    const {
      userId = null,
      filters = {},
      sort = [],
      from = 0,
      size = 20,
    } = options;

    const searchBody = {
      query: {
        bool: {
          must: [],
          filter: [],
        },
      },
      from,
      size,
    };

    // Add user filter
    if (userId) {
      searchBody.query.bool.filter.push({
        term: { userId: userId.toString() },
      });
    }

    // Add text search
    if (query) {
      searchBody.query.bool.must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description^2', 'transcript', 'content'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // Add filters
    if (filters.type) {
      searchBody.query.bool.filter.push({ term: { type: filters.type } });
    }
    if (filters.status) {
      searchBody.query.bool.filter.push({ term: { status: filters.status } });
    }
    if (filters.tags && filters.tags.length > 0) {
      searchBody.query.bool.filter.push({
        terms: { tags: filters.tags },
      });
    }
    if (filters.dateRange) {
      searchBody.query.bool.filter.push({
        range: {
          createdAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end,
          },
        },
      });
    }

    // Add sorting
    if (sort.length > 0) {
      searchBody.sort = sort;
    } else {
      searchBody.sort = [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }];
    }

    const response = await elasticsearchClient.search({
      index,
      body: searchBody,
    });

    return {
      hits: response.body.hits.hits.map(hit => ({
        ...hit._source,
        _id: hit._id,
        _score: hit._score,
      })),
      total: response.body.hits.total.value,
      took: response.body.took,
    };
  } catch (error) {
    logger.error('Elasticsearch search error', {
      index,
      query,
      error: error.message,
    });
    return null;
  }
}

/**
 * Delete document from index
 */
async function deleteDocument(index, id) {
  if (!isElasticsearchEnabled || !elasticsearchClient) {
    return false;
  }

  try {
    await elasticsearchClient.delete({
      index,
      id,
    });
    return true;
  } catch (error) {
    logger.error('Error deleting document', { index, id, error: error.message });
    return false;
  }
}

/**
 * Update document in index
 */
async function updateDocument(index, id, document) {
  if (!isElasticsearchEnabled || !elasticsearchClient) {
    return false;
  }

  try {
    await elasticsearchClient.update({
      index,
      id,
      body: {
        doc: document,
      },
    });
    return true;
  } catch (error) {
    logger.error('Error updating document', {
      index,
      id,
      error: error.message,
    });
    return false;
  }
}

/**
 * Get search suggestions (autocomplete)
 */
async function getSuggestions(index, query, size = 5) {
  if (!isElasticsearchEnabled || !elasticsearchClient) {
    return [];
  }

  try {
    const response = await elasticsearchClient.search({
      index,
      body: {
        suggest: {
          title_suggest: {
            prefix: query,
            completion: {
              field: 'title_suggest',
              size,
            },
          },
        },
      },
    });

    return (
      response.body.suggest?.title_suggest?.[0]?.options?.map(
        option => option.text
      ) || []
    );
  } catch (error) {
    logger.error('Error getting suggestions', {
      index,
      query,
      error: error.message,
    });
    return [];
  }
}

/**
 * Check if Elasticsearch is enabled
 */
function isEnabled() {
  return isElasticsearchEnabled;
}

module.exports = {
  initElasticsearch,
  indexDocument,
  search,
  deleteDocument,
  updateDocument,
  getSuggestions,
  isEnabled,
};






