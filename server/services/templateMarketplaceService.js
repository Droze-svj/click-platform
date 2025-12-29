// Template Marketplace Service

const ContentTemplate = require('../models/ContentTemplate');
const User = require('../models/User');
const { getOrSet } = require('./cacheService');
const logger = require('../utils/logger');

/**
 * Get marketplace templates
 */
async function getMarketplaceTemplates(options = {}) {
  try {
    const {
      category = null,
      niche = null,
      search = null,
      sortBy = 'popularity',
      limit = 20,
      skip = 0,
    } = options;

    const query = {
      isPublic: true,
      published: true,
    };

    if (category) {
      query.category = category;
    }

    if (niche) {
      query.niche = niche;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    let sort = {};
    switch (sortBy) {
      case 'popularity':
        sort = { usageCount: -1, rating: -1 };
        break;
      case 'recent':
        sort = { createdAt: -1 };
        break;
      case 'rating':
        sort = { rating: -1, usageCount: -1 };
        break;
      default:
        sort = { usageCount: -1 };
    }

    const [templates, total] = await Promise.all([
      ContentTemplate.find(query)
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .populate('createdBy', 'name email')
        .lean(),
      ContentTemplate.countDocuments(query),
    ]);

    return {
      templates,
      total,
      limit,
      skip,
    };
  } catch (error) {
    logger.error('Get marketplace templates error', { error: error.message });
    throw error;
  }
}

/**
 * Publish template to marketplace
 */
async function publishToMarketplace(templateId, userId) {
  try {
    const template = await ContentTemplate.findById(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.createdBy.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    template.isPublic = true;
    template.published = true;
    await template.save();

    logger.info('Template published to marketplace', { templateId, userId });
    return template;
  } catch (error) {
    logger.error('Publish template error', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Unpublish template from marketplace
 */
async function unpublishFromMarketplace(templateId, userId) {
  try {
    const template = await ContentTemplate.findById(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.createdBy.toString() !== userId.toString()) {
      throw new Error('Unauthorized');
    }

    template.isPublic = false;
    await template.save();

    logger.info('Template unpublished from marketplace', { templateId, userId });
    return template;
  } catch (error) {
    logger.error('Unpublish template error', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Rate template
 */
async function rateTemplate(templateId, userId, rating) {
  try {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = await ContentTemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Update rating (simple average for now)
    // In production, use a separate ratings collection
    if (!template.ratings) {
      template.ratings = [];
    }

    // Remove existing rating from user
    template.ratings = template.ratings.filter(
      r => r.userId.toString() !== userId.toString()
    );

    // Add new rating
    template.ratings.push({
      userId,
      rating,
      createdAt: new Date(),
    });

    // Calculate average rating
    const avgRating = template.ratings.reduce((sum, r) => sum + r.rating, 0) / template.ratings.length;
    template.rating = Math.round(avgRating * 10) / 10;

    await template.save();

    logger.info('Template rated', { templateId, userId, rating });
    return template;
  } catch (error) {
    logger.error('Rate template error', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Get template statistics
 */
async function getTemplateStats(templateId) {
  try {
    const cacheKey = `template:stats:${templateId}`;
    
    return await getOrSet(cacheKey, async () => {
      const template = await ContentTemplate.findById(templateId).lean();

      if (!template) {
        throw new Error('Template not found');
      }

      return {
        views: template.views || 0,
        usageCount: template.usageCount || 0,
        rating: template.rating || 0,
        ratingCount: template.ratings?.length || 0,
        downloads: template.downloads || 0,
      };
    }, 300); // Cache for 5 minutes
  } catch (error) {
    logger.error('Get template stats error', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Get featured templates
 */
async function getFeaturedTemplates(limit = 10) {
  try {
    const cacheKey = 'marketplace:featured';
    
    return await getOrSet(cacheKey, async () => {
      const templates = await ContentTemplate.find({
        isPublic: true,
        published: true,
        featured: true,
      })
        .sort({ usageCount: -1, rating: -1 })
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean();

      return templates;
    }, 1800); // Cache for 30 minutes
  } catch (error) {
    logger.error('Get featured templates error', { error: error.message });
    throw error;
  }
}

/**
 * Get trending templates
 */
async function getTrendingTemplates(limit = 10) {
  try {
    const cacheKey = 'marketplace:trending';
    
    return await getOrSet(cacheKey, async () => {
      // Templates with high usage in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const templates = await ContentTemplate.find({
        isPublic: true,
        published: true,
        updatedAt: { $gte: sevenDaysAgo },
      })
        .sort({ usageCount: -1, rating: -1 })
        .limit(limit)
        .populate('createdBy', 'name email')
        .lean();

      return templates;
    }, 3600); // Cache for 1 hour
  } catch (error) {
    logger.error('Get trending templates error', { error: error.message });
    throw error;
  }
}

module.exports = {
  getMarketplaceTemplates,
  publishToMarketplace,
  unpublishFromMarketplace,
  rateTemplate,
  getTemplateStats,
  getFeaturedTemplates,
  getTrendingTemplates,
};






