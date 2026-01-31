// Content Marketplace Service
// Infrastructure for content templates and assets marketplace

const logger = require('../utils/logger');
const { captureException } = require('../utils/sentry');
const Content = require('../models/Content');
const User = require('../models/User');

// Marketplace registry
const marketplaceItems = new Map(); // itemId -> item

/**
 * Create marketplace item
 * @param {Object} itemData - Item data
 * @returns {Promise<Object>} Created item
 */
async function createMarketplaceItem(itemData) {
  try {
    const {
      userId,
      type, // 'template', 'asset', 'music', 'effect'
      title,
      description,
      category,
      price,
      previewUrl,
      fileUrl,
      tags = [],
      metadata = {},
    } = itemData;

    const item = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      type,
      title,
      description,
      category,
      price: price || 0, // 0 = free
      previewUrl,
      fileUrl,
      tags,
      metadata,
      rating: 0,
      reviewCount: 0,
      downloadCount: 0,
      createdAt: new Date(),
      status: 'pending', // pending, approved, rejected
    };

    marketplaceItems.set(item.id, item);

    logger.info('Marketplace item created', { itemId: item.id, type, title });

    return item;
  } catch (error) {
    logger.error('Error creating marketplace item', { error: error.message });
    throw error;
  }
}

/**
 * Get marketplace items
 * @param {Object} filters - Filter options
 * @returns {Array} Items
 */
function getMarketplaceItems(filters = {}) {
  const {
    type,
    category,
    minPrice,
    maxPrice,
    tags,
    search,
    sortBy = 'popular', // popular, newest, price, rating
  } = filters;

  let items = Array.from(marketplaceItems.values());

  // Filter by type
  if (type) {
    items = items.filter((item) => item.type === type);
  }

  // Filter by category
  if (category) {
    items = items.filter((item) => item.category === category);
  }

  // Filter by price
  if (minPrice !== undefined) {
    items = items.filter((item) => item.price >= minPrice);
  }
  if (maxPrice !== undefined) {
    items = items.filter((item) => item.price <= maxPrice);
  }

  // Filter by tags
  if (tags && tags.length > 0) {
    items = items.filter((item) =>
      tags.some((tag) => item.tags.includes(tag))
    );
  }

  // Search
  if (search) {
    const searchLower = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower)
    );
  }

  // Sort
  switch (sortBy) {
    case 'popular':
      items.sort((a, b) => b.downloadCount - a.downloadCount);
      break;
    case 'newest':
      items.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'price':
      items.sort((a, b) => a.price - b.price);
      break;
    case 'rating':
      items.sort((a, b) => b.rating - a.rating);
      break;
  }

  return items;
}

/**
 * Purchase marketplace item
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object>} Purchase result
 */
async function purchaseItem(userId, itemId) {
  try {
    const item = marketplaceItems.get(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    // Check if already purchased
    // Would check user's purchases

    // Process payment (would integrate with payment service)
    if (item.price > 0) {
      // Process payment
      logger.info('Processing payment', { userId, itemId, price: item.price });
    }

    // Record purchase
    item.downloadCount++;
    marketplaceItems.set(itemId, item);

    logger.info('Item purchased', { userId, itemId });

    return {
      success: true,
      itemId,
      fileUrl: item.fileUrl,
      downloadUrl: item.fileUrl, // Would generate signed URL
    };
  } catch (error) {
    logger.error('Error purchasing item', { error: error.message, userId, itemId });
    throw error;
  }
}

/**
 * Rate marketplace item
 * @param {string} userId - User ID
 * @param {string} itemId - Item ID
 * @param {number} rating - Rating (1-5)
 * @param {string} review - Review text
 * @returns {Promise<Object>} Rating result
 */
async function rateItem(userId, itemId, rating, review = '') {
  try {
    const item = marketplaceItems.get(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Update rating (would store individual ratings)
    const currentRating = item.rating || 0;
    const currentCount = item.reviewCount || 0;
    const newRating = (currentRating * currentCount + rating) / (currentCount + 1);

    item.rating = newRating;
    item.reviewCount = currentCount + 1;
    marketplaceItems.set(itemId, item);

    logger.info('Item rated', { userId, itemId, rating });

    return {
      success: true,
      itemId,
      newRating: item.rating,
      reviewCount: item.reviewCount,
    };
  } catch (error) {
    logger.error('Error rating item', { error: error.message, userId, itemId });
    throw error;
  }
}

/**
 * Get user's marketplace items
 * @param {string} userId - User ID
 * @returns {Array} User's items
 */
function getUserMarketplaceItems(userId) {
  return Array.from(marketplaceItems.values()).filter(
    (item) => item.userId === userId
  );
}

module.exports = {
  createMarketplaceItem,
  getMarketplaceItems,
  purchaseItem,
  rateItem,
  getUserMarketplaceItems,
};
