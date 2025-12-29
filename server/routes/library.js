// Content library routes

const express = require('express');
const Content = require('../models/Content');
const ContentFolder = require('../models/ContentFolder');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const router = express.Router();

/**
 * @swagger
 * /api/library/folders:
 *   get:
 *     summary: Get user folders
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.get('/folders', auth, asyncHandler(async (req, res) => {
  const folders = await ContentFolder.find({ userId: req.user._id })
    .sort({ order: 1, name: 1 });
  sendSuccess(res, 'Folders fetched', 200, folders);
}));

/**
 * @swagger
 * /api/library/folders:
 *   post:
 *     summary: Create folder
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.post('/folders', auth, asyncHandler(async (req, res) => {
  const { name, description, color, parentFolderId } = req.body;

  if (!name) {
    return sendError(res, 'Folder name is required', 400);
  }

  const folder = new ContentFolder({
    userId: req.user._id,
    name,
    description: description || '',
    color: color || '#6366f1',
    parentFolderId: parentFolderId || null
  });

  await folder.save();
  sendSuccess(res, 'Folder created', 201, folder);
}));

/**
 * @swagger
 * /api/library/folders/{id}:
 *   put:
 *     summary: Update folder
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.put('/folders/:id', auth, asyncHandler(async (req, res) => {
  const folder = await ContentFolder.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!folder) {
    return sendError(res, 'Folder not found', 404);
  }

  if (req.body.name) folder.name = req.body.name;
  if (req.body.description !== undefined) folder.description = req.body.description;
  if (req.body.color) folder.color = req.body.color;
  if (req.body.parentFolderId !== undefined) folder.parentFolderId = req.body.parentFolderId;
  if (req.body.order !== undefined) folder.order = req.body.order;

  await folder.save();
  sendSuccess(res, 'Folder updated', 200, folder);
}));

/**
 * @swagger
 * /api/library/folders/{id}:
 *   delete:
 *     summary: Delete folder
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/folders/:id', auth, asyncHandler(async (req, res) => {
  const folder = await ContentFolder.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!folder) {
    return sendError(res, 'Folder not found', 404);
  }

  // Move contents to root (or delete them)
  await Content.updateMany(
    { folderId: folder._id, userId: req.user._id },
    { folderId: null }
  );

  await ContentFolder.deleteOne({ _id: folder._id });
  sendSuccess(res, 'Folder deleted', 200);
}));

/**
 * @swagger
 * /api/library/content:
 *   get:
 *     summary: Get organized content
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.get('/content', auth, asyncHandler(async (req, res) => {
  const {
    folderId,
    tag,
    category,
    isFavorite,
    isArchived,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 50,
    offset = 0
  } = req.query;

  const query = { userId: req.user._id };

  if (folderId) {
    if (folderId === 'null' || folderId === '') {
      query.folderId = null;
    } else {
      query.folderId = folderId;
    }
  }

  if (tag) {
    query.tags = { $in: [tag] };
  }

  if (category) {
    query.category = category;
  }

  if (isFavorite === 'true') {
    query.isFavorite = true;
  }

  if (isArchived === 'true') {
    query.isArchived = true;
  } else if (isArchived !== 'true') {
    query.isArchived = false; // Default: don't show archived
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const [content, total] = await Promise.all([
    Content.find(query)
      .sort(sort)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('folderId', 'name color'),
    Content.countDocuments(query)
  ]);

  sendSuccess(res, 'Content fetched', 200, {
    content,
    total,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

/**
 * @swagger
 * /api/library/content/{id}/organize:
 *   put:
 *     summary: Organize content (folder, tags, category)
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.put('/content/:id/organize', auth, asyncHandler(async (req, res) => {
  const content = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  if (req.body.folderId !== undefined) {
    content.folderId = req.body.folderId || null;
  }
  if (req.body.tags !== undefined) {
    content.tags = Array.isArray(req.body.tags) ? req.body.tags : [];
  }
  if (req.body.category !== undefined) {
    content.category = req.body.category;
  }
  if (req.body.isFavorite !== undefined) {
    content.isFavorite = req.body.isFavorite;
  }
  if (req.body.isArchived !== undefined) {
    content.isArchived = req.body.isArchived;
  }

  await content.save();
  sendSuccess(res, 'Content organized', 200, content);
}));

/**
 * @swagger
 * /api/library/tags:
 *   get:
 *     summary: Get all user tags
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.get('/tags', auth, asyncHandler(async (req, res) => {
  const contents = await Content.find({ userId: req.user._id }).select('tags');
  const allTags = contents.flatMap(c => c.tags || []);
  const uniqueTags = [...new Set(allTags)].sort();
  sendSuccess(res, 'Tags fetched', 200, uniqueTags);
}));

/**
 * @swagger
 * /api/library/categories:
 *   get:
 *     summary: Get all user categories
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.get('/categories', auth, asyncHandler(async (req, res) => {
  const contents = await Content.find({ userId: req.user._id }).select('category');
  const categories = [...new Set(contents.map(c => c.category).filter(Boolean))].sort();
  sendSuccess(res, 'Categories fetched', 200, categories);
}));

/**
 * @swagger
 * /api/library/content/{id}/duplicate:
 *   post:
 *     summary: Duplicate content
 *     tags: [Library]
 *     security:
 *       - bearerAuth: []
 */
router.post('/content/:id/duplicate', auth, asyncHandler(async (req, res) => {
  const original = await Content.findOne({
    _id: req.params.id,
    userId: req.user._id
  });

  if (!original) {
    return sendError(res, 'Content not found', 404);
  }

  const duplicated = new Content({
    ...original.toObject(),
    _id: undefined,
    title: `${original.title} (Copy)`,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await duplicated.save();
  sendSuccess(res, 'Content duplicated', 201, duplicated);
}));

// Library items routes
router.use('/', require('./library/items'));

/**
 * Advanced asset library features
 */
const {
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
} = require('../services/advancedAssetLibraryService');
const {
  createAssetFromTemplate,
  markAsTemplate,
  getUserTemplates
} = require('../services/assetTemplateService');

/**
 * POST /api/library/content/:id/version
 * Create asset version
 */
router.post('/content/:id/version', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const version = await createAssetVersion(req.user._id, id, req.body);
  sendSuccess(res, 'Asset version created', 201, version);
}));

/**
 * GET /api/library/content/:id/versions
 * Get asset versions
 */
router.get('/content/:id/versions', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const versions = await getAssetVersions(req.user._id, id);
  sendSuccess(res, 'Versions retrieved', 200, { versions });
}));

/**
 * POST /api/library/versions/:versionId/restore
 * Restore asset version
 */
router.post('/versions/:versionId/restore', auth, asyncHandler(async (req, res) => {
  const { versionId } = req.params;
  const content = await restoreAssetVersion(req.user._id, versionId);
  sendSuccess(res, 'Version restored', 200, content);
}));

/**
 * POST /api/library/collections
 * Create asset collection
 */
router.post('/collections', auth, asyncHandler(async (req, res) => {
  const collection = await createAssetCollection(req.user._id, req.body);
  sendSuccess(res, 'Collection created', 201, collection);
}));

/**
 * GET /api/library/collections
 * Get user's collections
 */
router.get('/collections', auth, asyncHandler(async (req, res) => {
  const AssetCollection = require('../models/AssetCollection');
  const { isSmart = null } = req.query;

  const query = { userId: req.user._id };
  if (isSmart === 'true') query.isSmart = true;
  else if (isSmart === 'false') query.isSmart = false;

  const collections = await AssetCollection.find(query)
    .populate('contentIds', 'title type')
    .sort({ createdAt: -1 })
    .lean();

  sendSuccess(res, 'Collections retrieved', 200, { collections });
}));

/**
 * PUT /api/library/collections/:collectionId
 * Update collection
 */
router.put('/collections/:collectionId', auth, asyncHandler(async (req, res) => {
  const { collectionId } = req.params;
  const AssetCollection = require('../models/AssetCollection');

  const collection = await AssetCollection.findOneAndUpdate(
    { _id: collectionId, userId: req.user._id },
    req.body,
    { new: true }
  );

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  // Update smart collection if needed
  if (collection.isSmart && collection.smartRules) {
    await updateSmartCollection(collectionId, req.user._id);
  }

  sendSuccess(res, 'Collection updated', 200, collection);
}));

/**
 * DELETE /api/library/collections/:collectionId
 * Delete collection
 */
router.delete('/collections/:collectionId', auth, asyncHandler(async (req, res) => {
  const { collectionId } = req.params;
  const AssetCollection = require('../models/AssetCollection');

  const collection = await AssetCollection.findOneAndDelete({
    _id: collectionId,
    userId: req.user._id
  });

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  sendSuccess(res, 'Collection deleted', 200);
}));

/**
 * POST /api/library/collections/:collectionId/refresh
 * Refresh smart collection
 */
router.post('/collections/:collectionId/refresh', auth, asyncHandler(async (req, res) => {
  const { collectionId } = req.params;
  const collection = await updateSmartCollection(collectionId, req.user._id);
  sendSuccess(res, 'Smart collection refreshed', 200, collection);
}));

/**
 * GET /api/library/analytics
 * Get asset analytics
 */
router.get('/analytics', auth, asyncHandler(async (req, res) => {
  const { contentId = null } = req.query;
  const analytics = await getAssetAnalytics(req.user._id, contentId);
  sendSuccess(res, 'Analytics retrieved', 200, analytics);
}));

/**
 * POST /api/library/content/:id/optimize
 * Optimize asset
 */
router.post('/content/:id/optimize', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const optimizations = await optimizeAsset(req.user._id, id, req.body);
  sendSuccess(res, 'Asset optimized', 200, optimizations);
}));

/**
 * GET /api/library/recommendations
 * Get asset recommendations
 */
router.get('/recommendations', auth, asyncHandler(async (req, res) => {
  const {
    limit = 10,
    type = null,
    category = null,
    basedOn = 'usage',
    referenceContentId = null
  } = req.query;

  const recommendations = await getAssetRecommendations(req.user._id, {
    limit: parseInt(limit),
    type,
    category,
    basedOn,
    referenceContentId
  });

  sendSuccess(res, 'Recommendations retrieved', 200, recommendations);
}));

/**
 * POST /api/library/bulk-organize
 * Bulk organize assets
 */
router.post('/bulk-organize', auth, asyncHandler(async (req, res) => {
  const { assetIds, ...organizationData } = req.body;

  if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
    return sendError(res, 'Asset IDs array is required', 400);
  }

  const result = await bulkOrganizeAssets(req.user._id, assetIds, organizationData);
  sendSuccess(res, 'Assets organized', 200, result);
}));

/**
 * POST /api/library/search/advanced
 * Advanced asset search
 */
router.post('/search/advanced', auth, asyncHandler(async (req, res) => {
  const { searchQuery, ...filters } = req.body;

  const results = await advancedAssetSearch(req.user._id, searchQuery, filters);
  sendSuccess(res, 'Search completed', 200, results);
}));

/**
 * POST /api/library/content/:id/share
 * Share asset
 */
router.post('/content/:id/share', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const share = await shareAsset(req.user._id, id, req.body);
  sendSuccess(res, 'Asset shared', 200, share);
}));

/**
 * GET /api/library/shared
 * Get shared assets
 */
router.get('/shared', auth, asyncHandler(async (req, res) => {
  const { sharedWithMe = true, sharedByMe = true } = req.query;

  const shares = await getSharedAssets(req.user._id, {
    sharedWithMe: sharedWithMe === 'true',
    sharedByMe: sharedByMe === 'true'
  });

  sendSuccess(res, 'Shared assets retrieved', 200, { shares });
}));

/**
 * POST /api/library/content/:id/auto-tag
 * Auto-tag asset
 */
router.post('/content/:id/auto-tag', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await autoTagAsset(req.user._id, id);
  sendSuccess(res, 'Asset auto-tagged', 200, result);
}));

/**
 * GET /api/library/content/:id/performance
 * Track asset performance
 */
router.get('/content/:id/performance', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const performance = await trackAssetPerformance(req.user._id, id);
  sendSuccess(res, 'Performance tracked', 200, performance);
}));

/**
 * POST /api/library/relationships
 * Create asset relationship
 */
router.post('/relationships', auth, asyncHandler(async (req, res) => {
  const { sourceContentId, targetContentId, relationshipType, ...metadata } = req.body;

  if (!sourceContentId || !targetContentId || !relationshipType) {
    return sendError(res, 'Source content ID, target content ID, and relationship type are required', 400);
  }

  const relationship = await createAssetRelationship(
    req.user._id,
    sourceContentId,
    targetContentId,
    relationshipType,
    metadata
  );

  sendSuccess(res, 'Relationship created', 201, relationship);
}));

/**
 * POST /api/library/content/:id/detect-relationships
 * Auto-detect asset relationships
 */
router.post('/content/:id/detect-relationships', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await autoDetectRelationships(req.user._id, id);
  sendSuccess(res, 'Relationships detected', 200, result);
}));

/**
 * GET /api/library/content/:id/relationships
 * Get asset relationships
 */
router.get('/content/:id/relationships', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { relationshipType = null } = req.query;

  const relationships = await getAssetRelationships(req.user._id, id, relationshipType);
  sendSuccess(res, 'Relationships retrieved', 200, { relationships });
}));

/**
 * POST /api/library/export
 * Export assets
 */
router.post('/export', auth, asyncHandler(async (req, res) => {
  const { assetIds, format = 'json' } = req.body;

  if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
    return sendError(res, 'Asset IDs array is required', 400);
  }

  const exportData = await exportAssets(req.user._id, assetIds, format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="assets.csv"');
    res.send(exportData.csv);
  } else {
    sendSuccess(res, 'Assets exported', 200, exportData);
  }
}));

/**
 * GET /api/library/usage-insights
 * Get asset usage insights
 */
router.get('/usage-insights', auth, asyncHandler(async (req, res) => {
  const { contentId = null } = req.query;

  const insights = await getAssetUsageInsights(req.user._id, contentId);
  sendSuccess(res, 'Usage insights retrieved', 200, insights);
}));

/**
 * POST /api/library/templates/:templateId/create
 * Create asset from template
 */
router.post('/templates/:templateId/create', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const content = await createAssetFromTemplate(req.user._id, templateId, req.body);
  sendSuccess(res, 'Asset created from template', 201, content);
}));

/**
 * PUT /api/library/content/:id/template
 * Mark content as template
 */
router.put('/content/:id/template', auth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isTemplate = true } = req.body;
  const content = await markAsTemplate(req.user._id, id, isTemplate);
  sendSuccess(res, 'Template status updated', 200, content);
}));

/**
 * GET /api/library/templates
 * Get user's templates
 */
router.get('/templates', auth, asyncHandler(async (req, res) => {
  const { type = null, category = null } = req.query;
  const templates = await getUserTemplates(req.user._id, { type, category });
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

module.exports = router;







