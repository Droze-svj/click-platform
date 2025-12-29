// Content collections routes

const express = require('express');
const auth = require('../middleware/auth');
const Collection = require('../models/ContentCollection');
const Content = require('../models/Content');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: Get user's collections
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', auth, asyncHandler(async (req, res) => {
  const collections = await Collection.find({ userId: req.user._id })
    .populate('contentIds', 'title type status')
    .sort({ createdAt: -1 });

  const collectionsWithCount = collections.map(collection => ({
    ...collection.toObject(),
    contentCount: collection.contentIds.length,
  }));

  sendSuccess(res, 'Collections fetched', 200, collectionsWithCount);
}));

/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: Create a new collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', auth, asyncHandler(async (req, res) => {
  const { name, description, color } = req.body;

  if (!name) {
    return sendError(res, 'Collection name is required', 400);
  }

  const collection = new Collection({
    userId: req.user._id,
    name,
    description,
    color: color || '#8B5CF6',
    contentIds: [],
  });

  await collection.save();
  logger.info('Collection created', { collectionId: collection._id, userId: req.user._id });

  sendSuccess(res, 'Collection created', 201, collection);
}));

/**
 * @swagger
 * /api/collections/{collectionId}:
 *   get:
 *     summary: Get collection details
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:collectionId', auth, asyncHandler(async (req, res) => {
  const collection = await Collection.findOne({
    _id: req.params.collectionId,
    userId: req.user._id,
  }).populate('contentIds');

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  sendSuccess(res, 'Collection fetched', 200, collection);
}));

/**
 * @swagger
 * /api/collections/{collectionId}/content:
 *   post:
 *     summary: Add content to collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:collectionId/content', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const collection = await Collection.findOne({
    _id: req.params.collectionId,
    userId: req.user._id,
  });

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  // Verify content belongs to user
  const content = await Content.findOne({
    _id: contentId,
    userId: req.user._id,
  });

  if (!content) {
    return sendError(res, 'Content not found', 404);
  }

  // Add content if not already in collection
  if (!collection.contentIds.includes(contentId)) {
    collection.contentIds.push(contentId);
    await collection.save();
  }

  sendSuccess(res, 'Content added to collection', 200, collection);
}));

/**
 * @swagger
 * /api/collections/{collectionId}/content/{contentId}:
 *   delete:
 *     summary: Remove content from collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:collectionId/content/:contentId', auth, asyncHandler(async (req, res) => {
  const collection = await Collection.findOne({
    _id: req.params.collectionId,
    userId: req.user._id,
  });

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  collection.contentIds = collection.contentIds.filter(
    id => id.toString() !== req.params.contentId
  );
  await collection.save();

  sendSuccess(res, 'Content removed from collection', 200, collection);
}));

/**
 * @swagger
 * /api/collections/{collectionId}:
 *   delete:
 *     summary: Delete collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:collectionId', auth, asyncHandler(async (req, res) => {
  const collection = await Collection.findOneAndDelete({
    _id: req.params.collectionId,
    userId: req.user._id,
  });

  if (!collection) {
    return sendError(res, 'Collection not found', 404);
  }

  logger.info('Collection deleted', { collectionId: req.params.collectionId, userId: req.user._id });
  sendSuccess(res, 'Collection deleted', 200);
}));

module.exports = router;






