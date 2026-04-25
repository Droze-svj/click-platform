// Content Library Items Routes

const express = require('express');
const auth = require('../../middleware/auth');
const Content = require('../../models/Content');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const router = express.Router();

/**
 * GET /api/library/items
 * Get library items
 */
router.get('/items', auth, asyncHandler(async (req, res) => {
  const { type, search } = req.query;

  const query = {
    userId: req.user._id,
    isArchived: false,
    'metadata.inLibrary': true
  };

  if (type && type !== 'all') {
    query.type = type;
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { transcript: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const items = await Content.find(query)
    .sort({ 'metadata.lastUsed': -1, createdAt: -1 })
    .limit(50)
    .lean();

  const libraryItems = items.map(item => ({
    id: item._id,
    title: item.title,
    type: item.type,
    text: item.transcript || item.description || '',
    platforms: item.generatedContent?.socialPosts?.map(p => p.platform) || [],
    createdAt: item.createdAt,
    usageCount: item.metadata?.usageCount || 0
  }));

  sendSuccess(res, 'Library items retrieved', 200, {
    items: libraryItems
  });
}));

/**
 * POST /api/library/items/:itemId/use
 * Mark library item as used
 */
router.post('/items/:itemId/use', auth, asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  await Content.findByIdAndUpdate(itemId, {
    $inc: { 'metadata.usageCount': 1 },
    $set: { 'metadata.lastUsed': new Date() }
  });

  sendSuccess(res, 'Item usage tracked', 200);
}));

/**
 * POST /api/library/items/:itemId/duplicate
 * Duplicate library item
 */
router.post('/items/:itemId/duplicate', auth, asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const original = await Content.findOne({
    _id: itemId,
    userId: req.user._id
  });

  if (!original) {
    return sendError(res, 'Item not found', 404);
  }

  const duplicate = new Content({
    userId: req.user._id,
    title: `${original.title} (Copy)`,
    type: original.type,
    description: original.description,
    transcript: original.transcript,
    generatedContent: original.generatedContent,
    metadata: {
      ...original.metadata,
      inLibrary: true,
      usageCount: 0
    }
  });

  await duplicate.save();

  sendSuccess(res, 'Item duplicated', 200, {
    itemId: duplicate._id
  });
}));

module.exports = router;


