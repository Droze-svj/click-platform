// Advanced Asset Library Service
// Enhanced asset management with versioning, analytics, optimization, and organization

const Content = require('../models/Content');
const AssetVersion = require('../models/AssetVersion');
const AssetCollection = require('../models/AssetCollection');
const AssetShare = require('../models/AssetShare');
const AssetRelationship = require('../models/AssetRelationship');
const ScheduledPost = require('../models/ScheduledPost');
const logger = require('../utils/logger');

/**
 * Create asset version
 */
async function createAssetVersion(userId, contentId, versionData = {}) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Get current version number
    const latestVersion = await AssetVersion.findOne({ contentId })
      .sort({ version: -1 })
      .lean();

    const versionNumber = latestVersion ? latestVersion.version + 1 : 1;

    // Mark previous versions as not current
    await AssetVersion.updateMany(
      { contentId, isCurrent: true },
      { isCurrent: false }
    );

    // Create new version
    const version = new AssetVersion({
      contentId,
      userId,
      version: versionNumber,
      versionName: versionData.versionName || `Version ${versionNumber}`,
      changes: versionData.changes || '',
      content: {
        title: content.title,
        description: content.description,
        body: content.body || content.transcript,
        transcript: content.transcript,
        tags: content.tags || [],
        category: content.category
      },
      metadata: {
        createdBy: userId,
        fileSize: content.originalFile?.size || 0,
        fileUrl: content.originalFile?.url || null
      },
      isCurrent: true
    });

    await version.save();
    logger.info('Asset version created', { userId, contentId, version: versionNumber });
    return version;
  } catch (error) {
    logger.error('Error creating asset version', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get asset versions
 */
async function getAssetVersions(userId, contentId) {
  try {
    const content = await Content.findOne({
      _id: contentId,
      userId
    });

    if (!content) {
      throw new Error('Content not found');
    }

    const versions = await AssetVersion.find({ contentId, userId })
      .sort({ version: -1 })
      .lean();

    return versions;
  } catch (error) {
    logger.error('Error getting asset versions', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Restore asset version
 */
async function restoreAssetVersion(userId, versionId) {
  try {
    const version = await AssetVersion.findOne({
      _id: versionId,
      userId
    });

    if (!version) {
      throw new Error('Version not found');
    }

    const content = await Content.findById(version.contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    // Create new version from current state
    await createAssetVersion(userId, version.contentId, {
      changes: `Restored from version ${version.version}`
    });

    // Restore content from version
    content.title = version.content.title;
    content.description = version.content.description;
    content.body = version.content.body;
    content.transcript = version.content.transcript;
    content.tags = version.content.tags || [];
    content.category = version.content.category;

    await content.save();

    logger.info('Asset version restored', { userId, versionId, contentId: version.contentId });
    return content;
  } catch (error) {
    logger.error('Error restoring asset version', { error: error.message, userId, versionId });
    throw error;
  }
}

/**
 * Create asset collection
 */
async function createAssetCollection(userId, collectionData) {
  try {
    const {
      name,
      description,
      contentIds = [],
      tags = [],
      category = 'general',
      isSmart = false,
      smartRules = null
    } = collectionData;

    const collection = new AssetCollection({
      userId,
      name,
      description,
      contentIds,
      tags,
      category,
      isSmart,
      smartRules: isSmart ? smartRules : null
    });

    // If smart collection, populate based on rules
    if (isSmart && smartRules) {
      const smartContent = await findContentBySmartRules(userId, smartRules);
      collection.contentIds = smartContent.map(c => c._id);
    }

    await collection.save();
    logger.info('Asset collection created', { userId, collectionId: collection._id });
    return collection;
  } catch (error) {
    logger.error('Error creating asset collection', { error: error.message, userId });
    throw error;
  }
}

/**
 * Find content by smart rules
 */
async function findContentBySmartRules(userId, rules) {
  try {
    const query = { userId };

    if (rules.tags && rules.tags.length > 0) {
      query.tags = { $in: rules.tags };
    }

    if (rules.categories && rules.categories.length > 0) {
      query.category = { $in: rules.categories };
    }

    if (rules.types && rules.types.length > 0) {
      query.type = { $in: rules.types };
    }

    if (rules.dateRange) {
      query.createdAt = {};
      if (rules.dateRange.start) {
        query.createdAt.$gte = new Date(rules.dateRange.start);
      }
      if (rules.dateRange.end) {
        query.createdAt.$lte = new Date(rules.dateRange.end);
      }
    }

    let content = await Content.find(query).lean();

    // Filter by performance if specified
    if (rules.performanceThreshold) {
      const ScheduledPost = require('../models/ScheduledPost');
      const posts = await ScheduledPost.find({
        userId,
        contentId: { $in: content.map(c => c._id) },
        status: 'posted'
      }).lean();

      const contentPerformance = {};
      posts.forEach(post => {
        const cid = post.contentId.toString();
        if (!contentPerformance[cid]) {
          contentPerformance[cid] = {
            engagement: 0,
            views: 0
          };
        }
        contentPerformance[cid].engagement += post.analytics?.engagement || 0;
        contentPerformance[cid].views += post.analytics?.views || post.analytics?.impressions || 0;
      });

      content = content.filter(c => {
        const perf = contentPerformance[c._id.toString()];
        if (!perf) return false;
        if (rules.performanceThreshold.minEngagement && perf.engagement < rules.performanceThreshold.minEngagement) {
          return false;
        }
        if (rules.performanceThreshold.minViews && perf.views < rules.performanceThreshold.minViews) {
          return false;
        }
        return true;
      });
    }

    return content;
  } catch (error) {
    logger.error('Error finding content by smart rules', { error: error.message, userId });
    return [];
  }
}

/**
 * Update smart collection
 */
async function updateSmartCollection(collectionId, userId) {
  try {
    const collection = await AssetCollection.findOne({
      _id: collectionId,
      userId
    });

    if (!collection || !collection.isSmart) {
      throw new Error('Smart collection not found');
    }

    const smartContent = await findContentBySmartRules(userId, collection.smartRules);
    collection.contentIds = smartContent.map(c => c._id);
    collection.updatedAt = new Date();

    await collection.save();
    return collection;
  } catch (error) {
    logger.error('Error updating smart collection', { error: error.message, collectionId });
    throw error;
  }
}

/**
 * Get asset analytics
 */
async function getAssetAnalytics(userId, contentId = null) {
  try {
    const query = { userId };
    if (contentId) {
      query._id = contentId;
    }

    const content = await Content.find(query).lean();
    const contentIds = content.map(c => c._id);

    // Get scheduled posts
    const posts = await ScheduledPost.find({
      userId,
      contentId: { $in: contentIds },
      status: 'posted'
    }).lean();

    const analytics = {
      totalAssets: content.length,
      byType: {},
      byCategory: {},
      byTag: {},
      totalUsage: posts.length,
      averageUsage: 0,
      topAssets: [],
      unusedAssets: [],
      recentlyUsed: [],
      storageUsed: 0
    };

    // Type distribution
    content.forEach(asset => {
      analytics.byType[asset.type] = (analytics.byType[asset.type] || 0) + 1;
      analytics.storageUsed += asset.originalFile?.size || 0;
    });

    // Category distribution
    content.forEach(asset => {
      const cat = asset.category || 'uncategorized';
      analytics.byCategory[cat] = (analytics.byCategory[cat] || 0) + 1;
    });

    // Tag distribution
    content.forEach(asset => {
      (asset.tags || []).forEach(tag => {
        analytics.byTag[tag] = (analytics.byTag[tag] || 0) + 1;
      });
    });

    // Usage analysis
    const assetUsage = {};
    posts.forEach(post => {
      const cid = post.contentId?.toString();
      if (cid) {
        assetUsage[cid] = (assetUsage[cid] || 0) + 1;
      }
    });

    // Top assets
    analytics.topAssets = Object.entries(assetUsage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const asset = content.find(c => c._id.toString() === id);
        return {
          contentId: id,
          title: asset?.title || 'Untitled',
          usageCount: count,
          lastUsed: posts.find(p => p.contentId?.toString() === id)?.postedAt || null
        };
      });

    // Unused assets
    analytics.unusedAssets = content
      .filter(c => !assetUsage[c._id.toString()])
      .slice(0, 10)
      .map(c => ({
        contentId: c._id,
        title: c.title || 'Untitled',
        createdAt: c.createdAt
      }));

    // Recently used
    const recentlyUsedPosts = posts
      .sort((a, b) => new Date(b.postedAt || b.scheduledTime) - new Date(a.postedAt || a.scheduledTime))
      .slice(0, 10);

    analytics.recentlyUsed = recentlyUsedPosts.map(post => {
      const asset = content.find(c => c._id.toString() === post.contentId?.toString());
      return {
        contentId: post.contentId,
        title: asset?.title || 'Untitled',
        lastUsed: post.postedAt || post.scheduledTime,
        platform: post.platform
      };
    });

    analytics.averageUsage = content.length > 0 ? (analytics.totalUsage / content.length) : 0;

    return analytics;
  } catch (error) {
    logger.error('Error getting asset analytics', { error: error.message, userId });
    throw error;
  }
}

/**
 * Optimize asset
 */
async function optimizeAsset(userId, contentId, optimizationOptions = {}) {
  try {
    const {
      compressImages = false,
      generateThumbnails = false,
      extractMetadata = true,
      analyzeContent = true
    } = optimizationOptions;

    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const optimizations = {
      applied: [],
      recommendations: [],
      metadata: {}
    };

    // Extract metadata
    if (extractMetadata && content.originalFile) {
      optimizations.metadata = {
        fileSize: content.originalFile.size,
        filename: content.originalFile.filename,
        duration: content.originalFile.duration,
        mimeType: content.originalFile.mimeType || 'unknown'
      };
      optimizations.applied.push('metadata_extraction');
    }

    // Analyze content
    if (analyzeContent) {
      const analysis = await analyzeAssetContent(content);
      optimizations.metadata.analysis = analysis;
      optimizations.applied.push('content_analysis');

      // Generate recommendations
      if (analysis.wordCount < 100 && content.type === 'article') {
        optimizations.recommendations.push('Content is short. Consider expanding for better engagement.');
      }

      if (!content.tags || content.tags.length === 0) {
        optimizations.recommendations.push('Add tags to improve discoverability.');
      }

      if (!content.description) {
        optimizations.recommendations.push('Add description for better SEO and organization.');
      }
    }

    // Image compression (future)
    if (compressImages && content.type === 'video' && content.originalFile) {
      optimizations.recommendations.push('Image compression not yet implemented. Consider using external tools.');
    }

    // Thumbnail generation (future)
    if (generateThumbnails && content.type === 'video') {
      optimizations.recommendations.push('Thumbnail generation not yet implemented. Consider using video processing service.');
    }

    logger.info('Asset optimized', { userId, contentId, optimizations: optimizations.applied.length });
    return optimizations;
  } catch (error) {
    logger.error('Error optimizing asset', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Analyze asset content
 */
async function analyzeAssetContent(content) {
  try {
    const text = `${content.title || ''} ${content.description || ''} ${content.body || content.transcript || ''}`;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
      readingTime: Math.ceil(words.length / 200), // minutes at 200 WPM
      hasTags: (content.tags || []).length > 0,
      tagCount: (content.tags || []).length,
      hasDescription: !!content.description,
      hasMedia: !!content.originalFile?.url
    };
  } catch (error) {
    logger.error('Error analyzing asset content', { error: error.message });
    return {};
  }
}

/**
 * Get asset recommendations
 */
async function getAssetRecommendations(userId, options = {}) {
  try {
    const {
      limit = 10,
      type = null,
      category = null,
      basedOn = 'usage' // usage, performance, recency, similarity
    } = options;

    let recommendations = [];

    switch (basedOn) {
      case 'usage':
        // Most used assets
        const posts = await ScheduledPost.find({
          userId,
          status: 'posted'
        }).lean();

        const usageCount = {};
        posts.forEach(post => {
          const cid = post.contentId?.toString();
          if (cid) {
            usageCount[cid] = (usageCount[cid] || 0) + 1;
          }
        });

        const topUsed = Object.entries(usageCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
          .map(([id]) => id);

        recommendations = await Content.find({
          _id: { $in: topUsed },
          userId
        }).limit(limit).lean();
        break;

      case 'performance':
        // Best performing assets
        const performancePosts = await ScheduledPost.find({
          userId,
          status: 'posted',
          'analytics.engagement': { $exists: true }
        })
          .sort({ 'analytics.engagement': -1 })
          .limit(limit)
          .lean();

        const topPerformingIds = performancePosts.map(p => p.contentId).filter(Boolean);
        recommendations = await Content.find({
          _id: { $in: topPerformingIds },
          userId
        }).limit(limit).lean();
        break;

      case 'recency':
        // Recently created
        const query = { userId };
        if (type) query.type = type;
        if (category) query.category = category;

        recommendations = await Content.find(query)
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
        break;

      case 'similarity':
        // Similar assets (by tags/category)
        if (options.referenceContentId) {
          const reference = await Content.findById(options.referenceContentId);
          if (reference) {
            const similarQuery = {
              userId,
              _id: { $ne: options.referenceContentId }
            };

            if (reference.tags && reference.tags.length > 0) {
              similarQuery.tags = { $in: reference.tags };
            }
            if (reference.category) {
              similarQuery.category = reference.category;
            }

            recommendations = await Content.find(similarQuery)
              .limit(limit)
              .lean();
          }
        }
        break;
    }

    return {
      recommendations,
      basedOn,
      count: recommendations.length
    };
  } catch (error) {
    logger.error('Error getting asset recommendations', { error: error.message, userId });
    throw error;
  }
}

/**
 * Bulk organize assets
 */
async function bulkOrganizeAssets(userId, assetIds, organizationData) {
  try {
    const {
      folderId = null,
      tags = null,
      category = null,
      isFavorite = null,
      isArchived = null
    } = organizationData;

    const updates = {};
    if (folderId !== null) updates.folderId = folderId;
    if (tags !== null) updates.tags = tags;
    if (category !== null) updates.category = category;
    if (isFavorite !== null) updates.isFavorite = isFavorite;
    if (isArchived !== null) updates.isArchived = isArchived;

    const result = await Content.updateMany(
      { _id: { $in: assetIds }, userId },
      { $set: updates }
    );

    logger.info('Assets bulk organized', { userId, count: result.modifiedCount });
    return {
      updated: result.modifiedCount,
      total: assetIds.length
    };
  } catch (error) {
    logger.error('Error bulk organizing assets', { error: error.message, userId });
    throw error;
  }
}

/**
 * Advanced asset search
 */
async function advancedAssetSearch(userId, searchQuery, filters = {}) {
  try {
    const {
      type = null,
      category = null,
      tags = null,
      dateRange = null,
      minEngagement = null,
      folderId = null,
      isFavorite = null,
      isArchived = false,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = filters;

    const query = { userId, isArchived };

    // Text search
    if (searchQuery) {
      query.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { transcript: { $regex: searchQuery, $options: 'i' } },
        { tags: { $in: [new RegExp(searchQuery, 'i')] } }
      ];
    }

    // Filters
    if (type) query.type = type;
    if (category) query.category = category;
    if (tags && Array.isArray(tags)) query.tags = { $in: tags };
    if (folderId !== null) query.folderId = folderId;
    if (isFavorite !== null) query.isFavorite = isFavorite;

    // Date range
    if (dateRange) {
      query.createdAt = {};
      if (dateRange.start) query.createdAt.$gte = new Date(dateRange.start);
      if (dateRange.end) query.createdAt.$lte = new Date(dateRange.end);
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    let content = await Content.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('folderId', 'name color')
      .lean();

    // Filter by engagement if specified
    if (minEngagement) {
      const ScheduledPost = require('../models/ScheduledPost');
      const posts = await ScheduledPost.find({
        userId,
        contentId: { $in: content.map(c => c._id) },
        status: 'posted'
      }).lean();

      const contentEngagement = {};
      posts.forEach(post => {
        const cid = post.contentId?.toString();
        if (cid) {
          if (!contentEngagement[cid]) {
            contentEngagement[cid] = 0;
          }
          contentEngagement[cid] += post.analytics?.engagement || 0;
        }
      });

      content = content.filter(c => {
        const engagement = contentEngagement[c._id.toString()] || 0;
        return engagement >= minEngagement;
      });
    }

    const total = await Content.countDocuments(query);

    return {
      content,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      filters: {
        searchQuery,
        ...filters
      }
    };
  } catch (error) {
    logger.error('Error in advanced asset search', { error: error.message, userId });
    throw error;
  }
}

/**
 * Share asset
 */
async function shareAsset(userId, contentId, shareData) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const {
      userIds = [],
      isPublic = false,
      allowDownload = false,
      allowComments = true,
      expiresAt = null,
      accessCode = null
    } = shareData;

    // Find or create share record
    let share = await AssetShare.findOne({ contentId, ownerId: userId });
    
    if (!share) {
      share = new AssetShare({
        contentId,
        ownerId: userId,
        isPublic,
        allowDownload,
        allowComments,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        accessCode
      });
    } else {
      share.isPublic = isPublic;
      share.allowDownload = allowDownload;
      share.allowComments = allowComments;
      if (expiresAt) share.expiresAt = new Date(expiresAt);
      if (accessCode !== null) share.accessCode = accessCode;
    }

    // Add users to sharedWith
    if (userIds.length > 0) {
      const User = require('../models/User');
      const validUsers = await User.find({ _id: { $in: userIds } }).select('_id').lean();
      const validUserIds = validUsers.map(u => u._id);

      // Remove existing shares for these users
      share.sharedWith = share.sharedWith.filter(
        s => !validUserIds.some(id => id.toString() === s.userId.toString())
      );

      // Add new shares
      validUserIds.forEach(uid => {
        share.sharedWith.push({
          userId: uid,
          permission: shareData.permissions?.[uid.toString()] || 'view',
          sharedAt: new Date(),
          sharedBy: userId
        });
      });
    }

    await share.save();
    logger.info('Asset shared', { userId, contentId, sharedWith: userIds.length, isPublic });
    return share;
  } catch (error) {
    logger.error('Error sharing asset', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get shared assets
 */
async function getSharedAssets(userId, options = {}) {
  try {
    const { sharedWithMe = true, sharedByMe = true } = options;

    const shares = [];

    if (sharedWithMe) {
      const sharedWith = await AssetShare.find({
        'sharedWith.userId': userId
      })
        .populate('contentId', 'title type description')
        .populate('ownerId', 'name email')
        .lean();

      shares.push(...sharedWith.map(s => ({
        ...s,
        accessType: 'shared_with_me',
        permission: s.sharedWith.find(sw => sw.userId.toString() === userId.toString())?.permission || 'view'
      })));
    }

    if (sharedByMe) {
      const sharedBy = await AssetShare.find({ ownerId: userId })
        .populate('contentId', 'title type description')
        .lean();

      shares.push(...sharedBy.map(s => ({
        ...s,
        accessType: 'shared_by_me'
      })));
    }

    return shares;
  } catch (error) {
    logger.error('Error getting shared assets', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-tag asset
 */
async function autoTagAsset(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const { generateHashtags } = require('./hashtagService');
    const { detectLanguage } = require('./translationService');

    const text = `${content.title || ''} ${content.description || ''} ${content.body || content.transcript || ''}`;
    
    // Generate tags from content
    let suggestedTags = [];
    try {
      const hashtags = await generateHashtags(text, { count: 10 });
      if (Array.isArray(hashtags)) {
        suggestedTags = hashtags.map(h => {
          const tag = typeof h === 'string' ? h : h.tag || h.text || h;
          return tag.replace('#', '').toLowerCase();
        });
      }
    } catch (error) {
      logger.warn('Error generating tags', { error: error.message });
    }

    // Detect language and add language tag
    try {
      const langDetection = await detectLanguage(text);
      if (langDetection.language && langDetection.language !== 'en') {
        suggestedTags.push(`lang-${langDetection.language}`);
      }
    } catch (error) {
      logger.warn('Error detecting language', { error: error.message });
    }

    // Add type tag
    if (content.type) {
      suggestedTags.push(`type-${content.type}`);
    }

    // Add category tag
    if (content.category) {
      suggestedTags.push(`cat-${content.category}`);
    }

    // Remove duplicates and limit
    suggestedTags = [...new Set(suggestedTags)].slice(0, 15);

    // Merge with existing tags
    const existingTags = content.tags || [];
    const mergedTags = [...new Set([...existingTags, ...suggestedTags])];

    content.tags = mergedTags;
    await content.save();

    logger.info('Asset auto-tagged', { userId, contentId, tagsAdded: suggestedTags.length });
    return {
      suggestedTags,
      allTags: mergedTags,
      newTags: suggestedTags.filter(t => !existingTags.includes(t))
    };
  } catch (error) {
    logger.error('Error auto-tagging asset', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Track asset performance
 */
async function trackAssetPerformance(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const posts = await ScheduledPost.find({
      userId,
      contentId,
      status: 'posted'
    }).lean();

    const performance = {
      totalPosts: posts.length,
      totalEngagement: 0,
      totalViews: 0,
      totalImpressions: 0,
      averageEngagement: 0,
      averageEngagementRate: 0,
      bestPlatform: null,
      bestPost: null,
      platformBreakdown: {},
      trend: 'stable',
      lastUsed: null
    };

    if (posts.length === 0) {
      return performance;
    }

    posts.forEach(post => {
      const engagement = post.analytics?.engagement || 0;
      const views = post.analytics?.views || 0;
      const impressions = post.analytics?.impressions || views;

      performance.totalEngagement += engagement;
      performance.totalViews += views;
      performance.totalImpressions += impressions;

      // Platform breakdown
      if (!performance.platformBreakdown[post.platform]) {
        performance.platformBreakdown[post.platform] = {
          posts: 0,
          engagement: 0,
          views: 0,
          impressions: 0
        };
      }

      performance.platformBreakdown[post.platform].posts++;
      performance.platformBreakdown[post.platform].engagement += engagement;
      performance.platformBreakdown[post.platform].views += views;
      performance.platformBreakdown[post.platform].impressions += impressions;
    });

    performance.averageEngagement = Math.round(performance.totalEngagement / posts.length);
    performance.averageEngagementRate = performance.totalImpressions > 0
      ? (performance.totalEngagement / performance.totalImpressions) * 100
      : 0;

    // Find best platform
    const platformEntries = Object.entries(performance.platformBreakdown);
    if (platformEntries.length > 0) {
      const sorted = platformEntries.sort((a, b) => {
        const avgA = a[1].engagement / a[1].posts;
        const avgB = b[1].engagement / b[1].posts;
        return avgB - avgA;
      });
      performance.bestPlatform = sorted[0][0];
    }

    // Find best post
    const bestPost = posts.sort((a, b) => 
      (b.analytics?.engagement || 0) - (a.analytics?.engagement || 0)
    )[0];
    if (bestPost) {
      performance.bestPost = {
        postId: bestPost._id,
        platform: bestPost.platform,
        engagement: bestPost.analytics?.engagement || 0,
        postedAt: bestPost.postedAt || bestPost.scheduledTime
      };
    }

    // Calculate trend
    if (posts.length >= 2) {
      const recent = posts.slice(0, 2);
      const older = posts.slice(2, 4);
      
      const recentAvg = recent.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / recent.length;
      const olderAvg = older.length > 0 
        ? older.reduce((sum, p) => sum + (p.analytics?.engagement || 0), 0) / older.length
        : recentAvg;

      if (recentAvg > olderAvg * 1.1) {
        performance.trend = 'improving';
      } else if (recentAvg < olderAvg * 0.9) {
        performance.trend = 'declining';
      }
    }

    performance.lastUsed = posts[0]?.postedAt || posts[0]?.scheduledTime || null;

    return performance;
  } catch (error) {
    logger.error('Error tracking asset performance', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Create asset relationship
 */
async function createAssetRelationship(userId, sourceContentId, targetContentId, relationshipType, metadata = {}) {
  try {
    // Verify both assets belong to user
    const [source, target] = await Promise.all([
      Content.findOne({ _id: sourceContentId, userId }),
      Content.findOne({ _id: targetContentId, userId })
    ]);

    if (!source || !target) {
      throw new Error('One or both assets not found');
    }

    if (sourceContentId.toString() === targetContentId.toString()) {
      throw new Error('Cannot create relationship with itself');
    }

    const relationship = new AssetRelationship({
      userId,
      sourceContentId,
      targetContentId,
      relationshipType,
      strength: metadata.strength || 50,
      metadata: {
        description: metadata.description || '',
        autoDetected: metadata.autoDetected || false,
        detectedBy: metadata.detectedBy || 'user'
      }
    });

    await relationship.save();
    logger.info('Asset relationship created', { userId, sourceContentId, targetContentId, relationshipType });
    return relationship;
  } catch (error) {
    logger.error('Error creating asset relationship', { error: error.message, userId });
    throw error;
  }
}

/**
 * Auto-detect asset relationships
 */
async function autoDetectRelationships(userId, contentId) {
  try {
    const content = await Content.findById(contentId);
    if (!content || content.userId.toString() !== userId.toString()) {
      throw new Error('Content not found');
    }

    const relationships = [];

    // Find similar content by tags
    if (content.tags && content.tags.length > 0) {
      const similarByTags = await Content.find({
        userId,
        _id: { $ne: contentId },
        tags: { $in: content.tags }
      }).limit(10).lean();

      for (const similar of similarByTags) {
        const tagOverlap = similar.tags.filter(t => content.tags.includes(t)).length;
        const strength = Math.min(100, tagOverlap * 20);

        if (strength >= 20) {
          relationships.push({
            targetContentId: similar._id,
            relationshipType: 'related',
            strength,
            autoDetected: true
          });
        }
      }
    }

    // Find similar by category
    if (content.category) {
      const similarByCategory = await Content.find({
        userId,
        _id: { $ne: contentId },
        category: content.category
      }).limit(5).lean();

      for (const similar of similarByCategory) {
        // Check if relationship already exists
        const existing = await AssetRelationship.findOne({
          userId,
          sourceContentId: contentId,
          targetContentId: similar._id
        });

        if (!existing) {
          relationships.push({
            targetContentId: similar._id,
            relationshipType: 'related',
            strength: 40,
            autoDetected: true
          });
        }
      }
    }

    // Create relationships
    const created = [];
    for (const rel of relationships) {
      try {
        const relationship = await createAssetRelationship(
          userId,
          contentId,
          rel.targetContentId,
          rel.relationshipType,
          {
            strength: rel.strength,
            autoDetected: true,
            detectedBy: 'ai'
          }
        );
        created.push(relationship);
      } catch (error) {
        // Relationship might already exist
        logger.warn('Error creating relationship', { error: error.message });
      }
    }

    return {
      detected: relationships.length,
      created: created.length,
      relationships: created
    };
  } catch (error) {
    logger.error('Error auto-detecting relationships', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Get asset relationships
 */
async function getAssetRelationships(userId, contentId, relationshipType = null) {
  try {
    const query = {
      userId,
      $or: [
        { sourceContentId: contentId },
        { targetContentId: contentId }
      ]
    };

    if (relationshipType) {
      query.relationshipType = relationshipType;
    }

    const relationships = await AssetRelationship.find(query)
      .populate('sourceContentId', 'title type')
      .populate('targetContentId', 'title type')
      .sort({ strength: -1 })
      .lean();

    return relationships.map(rel => ({
      ...rel,
      relatedContent: rel.sourceContentId._id.toString() === contentId.toString()
        ? rel.targetContentId
        : rel.sourceContentId,
      direction: rel.sourceContentId._id.toString() === contentId.toString() ? 'outgoing' : 'incoming'
    }));
  } catch (error) {
    logger.error('Error getting asset relationships', { error: error.message, userId, contentId });
    throw error;
  }
}

/**
 * Export assets
 */
async function exportAssets(userId, assetIds, format = 'json') {
  try {
    const content = await Content.find({
      _id: { $in: assetIds },
      userId
    }).lean();

    if (format === 'json') {
      return {
        format: 'json',
        exportedAt: new Date().toISOString(),
        count: content.length,
        assets: content.map(c => ({
          id: c._id,
          title: c.title,
          description: c.description,
          type: c.type,
          category: c.category,
          tags: c.tags || [],
          body: c.body || c.transcript,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }))
      };
    } else if (format === 'csv') {
      // Generate CSV
      const headers = ['ID', 'Title', 'Type', 'Category', 'Tags', 'Created At'];
      const rows = content.map(c => [
        c._id,
        c.title || '',
        c.type || '',
        c.category || '',
        (c.tags || []).join('; '),
        c.createdAt
      ]);

      return {
        format: 'csv',
        exportedAt: new Date().toISOString(),
        count: content.length,
        csv: [headers, ...rows].map(row => row.join(',')).join('\n')
      };
    }

    throw new Error('Unsupported export format');
  } catch (error) {
    logger.error('Error exporting assets', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get asset usage insights
 */
async function getAssetUsageInsights(userId, contentId = null) {
  try {
    const query = { userId };
    if (contentId) {
      query._id = contentId;
    }

    const content = await Content.find(query).lean();
    const contentIds = content.map(c => c._id);

    const posts = await ScheduledPost.find({
      userId,
      contentId: { $in: contentIds },
      status: 'posted'
    }).lean();

    const insights = {
      totalAssets: content.length,
      usedAssets: 0,
      unusedAssets: 0,
      averageUsagePerAsset: 0,
      mostUsedAsset: null,
      leastUsedAsset: null,
      usageDistribution: {
        never: 0,
        once: 0,
        '2-5': 0,
        '6-10': 0,
        '11+': 0
      },
      platformUsage: {},
      timeToFirstUse: {},
      usageFrequency: {}
    };

    // Calculate usage per asset
    const assetUsage = {};
    posts.forEach(post => {
      const cid = post.contentId?.toString();
      if (cid) {
        assetUsage[cid] = (assetUsage[cid] || 0) + 1;
      }
    });

    // Categorize usage
    content.forEach(asset => {
      const usage = assetUsage[asset._id.toString()] || 0;
      
      if (usage === 0) {
        insights.unusedAssets++;
        insights.usageDistribution.never++;
      } else {
        insights.usedAssets++;
        
        if (usage === 1) insights.usageDistribution.once++;
        else if (usage >= 2 && usage <= 5) insights.usageDistribution['2-5']++;
        else if (usage >= 6 && usage <= 10) insights.usageDistribution['6-10']++;
        else insights.usageDistribution['11+']++;
      }

      // Time to first use
      const firstPost = posts
        .filter(p => p.contentId?.toString() === asset._id.toString())
        .sort((a, b) => new Date(a.postedAt || a.scheduledTime) - new Date(b.postedAt || b.scheduledTime))[0];

      if (firstPost && asset.createdAt) {
        const daysToFirstUse = Math.floor(
          (new Date(firstPost.postedAt || firstPost.scheduledTime) - new Date(asset.createdAt)) / (1000 * 60 * 60 * 24)
        );
        
        if (daysToFirstUse >= 0) {
          if (daysToFirstUse === 0) {
            insights.timeToFirstUse['same_day'] = (insights.timeToFirstUse['same_day'] || 0) + 1;
          } else if (daysToFirstUse <= 7) {
            insights.timeToFirstUse['within_week'] = (insights.timeToFirstUse['within_week'] || 0) + 1;
          } else if (daysToFirstUse <= 30) {
            insights.timeToFirstUse['within_month'] = (insights.timeToFirstUse['within_month'] || 0) + 1;
          } else {
            insights.timeToFirstUse['over_month'] = (insights.timeToFirstUse['over_month'] || 0) + 1;
          }
        }
      }
    });

    // Find most/least used
    const usageEntries = Object.entries(assetUsage);
    if (usageEntries.length > 0) {
      const sorted = usageEntries.sort((a, b) => b[1] - a[1]);
      const mostUsedId = sorted[0][0];
      const leastUsedId = sorted[sorted.length - 1][0];

      insights.mostUsedAsset = {
        contentId: mostUsedId,
        title: content.find(c => c._id.toString() === mostUsedId)?.title || 'Untitled',
        usageCount: sorted[0][1]
      };

      insights.leastUsedAsset = {
        contentId: leastUsedId,
        title: content.find(c => c._id.toString() === leastUsedId)?.title || 'Untitled',
        usageCount: sorted[sorted.length - 1][1]
      };
    }

    // Platform usage
    posts.forEach(post => {
      const cid = post.contentId?.toString();
      if (cid && assetUsage[cid]) {
        if (!insights.platformUsage[post.platform]) {
          insights.platformUsage[post.platform] = 0;
        }
        insights.platformUsage[post.platform]++;
      }
    });

    insights.averageUsagePerAsset = content.length > 0 
      ? (Object.values(assetUsage).reduce((a, b) => a + b, 0) / content.length)
      : 0;

    return insights;
  } catch (error) {
    logger.error('Error getting asset usage insights', { error: error.message, userId });
    throw error;
  }
}

module.exports = {
  createAssetVersion,
  getAssetVersions,
  restoreAssetVersion,
  createAssetCollection,
  updateSmartCollection,
  getAssetAnalytics,
  optimizeAsset,
  getAssetRecommendations,
  bulkOrganizeAssets,
  advancedAssetSearch,
  shareAsset,
  getSharedAssets,
  autoTagAsset,
  trackAssetPerformance,
  createAssetRelationship,
  autoDetectRelationships,
  getAssetRelationships,
  exportAssets,
  getAssetUsageInsights
};

