// Bulk operations routes

const express = require('express');
const auth = require('../middleware/auth');
const Content = require('../models/Content');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/batch/update:
 *   post:
 *     summary: Bulk update content
 *     tags: [Batch]
 *     security:
 *       - bearerAuth: []
 */
router.post('/update', auth, asyncHandler(async (req, res) => {
  const { contentIds, updates } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return sendError(res, 'Updates object is required', 400);
  }

  // Verify all content belongs to user
  const contents = await Content.find({
    _id: { $in: contentIds },
    userId: req.user._id,
  });

  if (contents.length !== contentIds.length) {
    return sendError(res, 'Some content items not found or access denied', 403);
  }

  // Update all content
  const result = await Content.updateMany(
    { _id: { $in: contentIds }, userId: req.user._id },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  logger.info('Bulk content update', {
    userId: req.user._id,
    count: result.modifiedCount,
    updates: Object.keys(updates),
  });

  sendSuccess(res, `Updated ${result.modifiedCount} item(s)`, 200, {
    modifiedCount: result.modifiedCount,
  });
}));

/**
 * @swagger
 * /api/batch/delete:
 *   post:
 *     summary: Bulk delete content
 *     tags: [Batch]
 *     security:
 *       - bearerAuth: []
 */
router.post('/delete', auth, asyncHandler(async (req, res) => {
  const { contentIds } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  // Verify all content belongs to user
  const contents = await Content.find({
    _id: { $in: contentIds },
    userId: req.user._id,
  });

  if (contents.length !== contentIds.length) {
    return sendError(res, 'Some content items not found or access denied', 403);
  }

  // Delete all content
  const result = await Content.deleteMany({
    _id: { $in: contentIds },
    userId: req.user._id,
  });

  logger.info('Bulk content delete', {
    userId: req.user._id,
    count: result.deletedCount,
  });

  sendSuccess(res, `Deleted ${result.deletedCount} item(s)`, 200, {
    deletedCount: result.deletedCount,
  });
}));

/**
 * @swagger
 * /api/batch/tag:
 *   post:
 *     summary: Bulk tag content
 *     tags: [Batch]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tag', auth, asyncHandler(async (req, res) => {
  const { contentIds, tags, action = 'add' } = req.body;

  if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
    return sendError(res, 'Content IDs array is required', 400);
  }

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return sendError(res, 'Tags array is required', 400);
  }

  // Verify all content belongs to user
  const contents = await Content.find({
    _id: { $in: contentIds },
    userId: req.user._id,
  });

  if (contents.length !== contentIds.length) {
    return sendError(res, 'Some content items not found or access denied', 403);
  }

  let result;
  if (action === 'add') {
    // Add tags to all content
    result = await Content.updateMany(
      { _id: { $in: contentIds }, userId: req.user._id },
      { $addToSet: { tags: { $each: tags } } }
    );
  } else if (action === 'remove') {
    // Remove tags from all content
    result = await Content.updateMany(
      { _id: { $in: contentIds }, userId: req.user._id },
      { $pull: { tags: { $in: tags } } }
    );
  } else {
    // Replace tags
    result = await Content.updateMany(
      { _id: { $in: contentIds }, userId: req.user._id },
      { $set: { tags } }
    );
  }

  logger.info('Bulk tag operation', {
    userId: req.user._id,
    count: result.modifiedCount,
    action,
    tags,
  });

  sendSuccess(res, `${action === 'add' ? 'Added' : action === 'remove' ? 'Removed' : 'Updated'} tags on ${result.modifiedCount} item(s)`, 200, {
    modifiedCount: result.modifiedCount,
  });
}));

module.exports = router;
