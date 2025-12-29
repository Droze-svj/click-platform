// Import functionality routes

const express = require('express');
const Content = require('../models/Content');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { bulkInsert } = require('../utils/bulkOperations');
const router = express.Router();

/**
 * @swagger
 * /api/import/content:
 *   post:
 *     summary: Import content from JSON
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.post('/content', auth, asyncHandler(async (req, res) => {
  const { data } = req.body;

  if (!data || !Array.isArray(data)) {
    return sendError(res, 'data must be an array of content items', 400);
  }

  // Validate and prepare content items
  const contentItems = data.map(item => ({
    userId: req.user._id,
    type: item.type || 'article',
    title: item.title || 'Imported Content',
    description: item.description,
    transcript: item.transcript,
    status: 'completed',
    generatedContent: item.generatedContent || {},
    tags: item.tags || [],
    category: item.category || 'general',
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: new Date()
  }));

  // Insert content
  const result = await bulkInsert(Content, contentItems);

  sendSuccess(res, `Imported ${result.length} content items`, 201, {
    imported: result.length,
    items: result
  });
}));

/**
 * @swagger
 * /api/import/scripts:
 *   post:
 *     summary: Import scripts from JSON
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.post('/scripts', auth, asyncHandler(async (req, res) => {
  const { data } = req.body;
  const Script = require('../models/Script');

  if (!data || !Array.isArray(data)) {
    return sendError(res, 'data must be an array of script items', 400);
  }

  const scriptItems = data.map(item => ({
    userId: req.user._id,
    type: item.type || 'youtube',
    title: item.title || 'Imported Script',
    script: item.script || '',
    status: 'completed',
    metadata: item.metadata || {},
    createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
    updatedAt: new Date()
  }));

  const result = await bulkInsert(Script, scriptItems);

  sendSuccess(res, `Imported ${result.length} scripts`, 201, {
    imported: result.length,
    items: result
  });
}));

module.exports = router;

