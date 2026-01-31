// Template Marketplace Service
// Browse, search, download, rate, and monetize video editing templates

const logger = require('../utils/logger');
const Template = require('../models/Template');
const UserPreferences = require('../models/UserPreferences');

/**
 * Create template model if it doesn't exist
 */
let TemplateModel;
try {
  TemplateModel = require('../models/Template');
} catch (error) {
  // Create schema if model doesn't exist
  const mongoose = require('mongoose');
  const templateSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String, required: true },
    type: { type: String, enum: ['color-grading', 'text', 'transition', 'effect-chain', 'export'], required: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true },
    thumbnail: { type: String },
    isPublic: { type: Boolean, default: false },
    isPremium: { type: Boolean, default: false },
    price: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviews: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      createdAt: { type: Date, default: Date.now }
    }],
    tags: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });
  TemplateModel = mongoose.model('Template', templateSchema);
}

/**
 * Browse templates
 */
async function browseTemplates(filters = {}) {
  try {
    const {
      category,
      type,
      search,
      sortBy = 'popular', // popular, recent, rating, price
      minRating = 0,
      isPremium = null,
      limit = 20,
      skip = 0
    } = filters;

    const query = { isPublic: true };

    if (category) query.category = category;
    if (type) query.type = type;
    if (minRating > 0) query.rating = { $gte: minRating };
    if (isPremium !== null) query.isPremium = isPremium;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    let sort = {};
    switch (sortBy) {
      case 'popular':
        sort = { downloads: -1 };
        break;
      case 'recent':
        sort = { createdAt: -1 };
        break;
      case 'rating':
        sort = { rating: -1 };
        break;
      case 'price':
        sort = { price: 1 };
        break;
    }

    const templates = await TemplateModel.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email')
      .lean();

    const total = await TemplateModel.countDocuments(query);

    return {
      templates,
      total,
      page: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Browse templates error', { error: error.message });
    throw error;
  }
}

/**
 * Get template details
 */
async function getTemplateDetails(templateId, userId = null) {
  try {
    const template = await TemplateModel.findById(templateId)
      .populate('userId', 'name email')
      .lean();

    if (!template) {
      throw new Error('Template not found');
    }

    if (!template.isPublic && template.userId.toString() !== userId?.toString()) {
      throw new Error('Template not accessible');
    }

    // Increment view count (async)
    TemplateModel.findByIdAndUpdate(templateId, { $inc: { views: 1 } }).catch(() => {});

    return template;
  } catch (error) {
    logger.error('Get template details error', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Create template
 */
async function createTemplate(userId, templateData) {
  try {
    const {
      name,
      description,
      category,
      type,
      settings,
      thumbnail,
      isPublic = false,
      isPremium = false,
      price = 0,
      tags = []
    } = templateData;

    const template = new TemplateModel({
      userId,
      name,
      description,
      category,
      type,
      settings,
      thumbnail,
      isPublic,
      isPremium,
      price,
      tags,
      downloads: 0,
      rating: 0,
      reviews: []
    });

    await template.save();

    logger.info('Template created', { templateId: template._id, userId, type });
    return template;
  } catch (error) {
    logger.error('Create template error', { error: error.message, userId });
    throw error;
  }
}

/**
 * Download template
 */
async function downloadTemplate(templateId, userId) {
  try {
    const template = await TemplateModel.findById(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    if (!template.isPublic && template.userId.toString() !== userId?.toString()) {
      throw new Error('Template not accessible');
    }

    // Check if premium and user has access
    if (template.isPremium && template.price > 0) {
      // In production, check payment/subscription
      // For now, allow download
    }

    // Increment download count
    template.downloads = (template.downloads || 0) + 1;
    await template.save();

    // Track user download
    try {
      const preferences = await UserPreferences.findOne({ userId });
      if (preferences) {
        if (!preferences.downloadedTemplates) {
          preferences.downloadedTemplates = [];
        }
        if (!preferences.downloadedTemplates.includes(templateId)) {
          preferences.downloadedTemplates.push(templateId);
          await preferences.save();
        }
      }
    } catch (err) {
      logger.warn('Failed to track template download', { error: err.message });
    }

    logger.info('Template downloaded', { templateId, userId });
    return {
      template: template.toObject(),
      settings: template.settings
    };
  } catch (error) {
    logger.error('Download template error', { error: error.message, templateId, userId });
    throw error;
  }
}

/**
 * Rate template
 */
async function rateTemplate(templateId, userId, rating, comment = null) {
  try {
    const template = await TemplateModel.findById(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    // Remove existing review from user
    template.reviews = template.reviews.filter(r => r.userId.toString() !== userId.toString());
    
    // Add new review
    template.reviews.push({
      userId,
      rating,
      comment,
      createdAt: new Date()
    });

    // Calculate average rating
    const totalRating = template.reviews.reduce((sum, r) => sum + r.rating, 0);
    template.rating = totalRating / template.reviews.length;

    await template.save();

    logger.info('Template rated', { templateId, userId, rating });
    return { success: true, newRating: template.rating };
  } catch (error) {
    logger.error('Rate template error', { error: error.message, templateId, userId });
    throw error;
  }
}

/**
 * Get template categories
 */
function getTemplateCategories() {
  return {
    'color-grading': {
      name: 'Color Grading',
      description: 'Color grading presets and LUTs',
      icon: 'palette'
    },
    'text': {
      name: 'Text Templates',
      description: 'Animated text and title templates',
      icon: 'type'
    },
    'transition': {
      name: 'Transitions',
      description: 'Video transition effects',
      icon: 'film'
    },
    'effect-chain': {
      name: 'Effect Chains',
      description: 'Pre-configured effect combinations',
      icon: 'sparkles'
    },
    'export': {
      name: 'Export Presets',
      description: 'Platform-optimized export settings',
      icon: 'download'
    }
  };
}

/**
 * Get featured templates
 */
async function getFeaturedTemplates(limit = 10) {
  try {
    const templates = await TemplateModel.find({
      isPublic: true,
      rating: { $gte: 4.0 }
    })
      .sort({ downloads: -1, rating: -1 })
      .limit(limit)
      .populate('userId', 'name')
      .lean();

    return templates;
  } catch (error) {
    logger.error('Get featured templates error', { error: error.message });
    return [];
  }
}

module.exports = {
  browseTemplates,
  getTemplateDetails,
  createTemplate,
  downloadTemplate,
  rateTemplate,
  getTemplateCategories,
  getFeaturedTemplates,
};
