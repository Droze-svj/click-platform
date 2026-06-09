const express = require('express');
const router = express.Router();
const vectorMemoryService = require('../services/vectorMemoryService');
const logger = require('../utils/logger');

// In production, add a requireAuth middleware to these routes
const authenticate = (req, res, next) => {
  req.user = { id: 'test_user_v6' }; // Temporary mock user ID until auth is fully re-integrated
  next();
};

/**
 * @route POST /api/memory/store
 * @desc Stashes an edit preference in the vector RAG database
 */
router.post('/store', authenticate, async (req, res) => {
  try {
    const { text, metadata } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing preferred text memory" });
    }

    const success = await vectorMemoryService.storeUserMemory(req.user.id, text, metadata);
    if (!success) {
      return res.status(500).json({ error: "Failed to generate embeddings. Could not store memory." });
    }

    res.json({ message: "Contextual memory securely stashed.", status: 200 });
  } catch (error) {
    logger.error('[VectorMemory] Store Error:', error);
    res.status(500).json({ error: "Server Error storing semantic memory" });
  }
});

/**
 * @route GET /api/memory/query
 * @desc Retrieve contextual editing preferences from RAG
 */
router.get('/query', authenticate, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const results = await vectorMemoryService.queryUserMemory(req.user.id, query);
    res.json({ results, status: 200 });
  } catch (error) {
    logger.error('Query semantic memory error', { error: error.message });
    res.status(500).json({ error: "Server Error querying semantic memory" });
  }
});

/**
 * @route DELETE /api/memory/:memoryId
 * @desc Delete a specific contextual editing preference
 */
router.delete('/:memoryId', authenticate, async (req, res) => {
  try {
    const { memoryId } = req.params;
    if (!memoryId) {
      return res.status(400).json({ error: "Missing memory ID" });
    }

    const success = await vectorMemoryService.deleteUserMemory(req.user.id, memoryId);
    if (!success) {
      return res.status(404).json({ error: "Memory not found or could not be deleted" });
    }

    res.json({ message: "Memory successfully deleted.", status: 200 });
  } catch (error) {
    res.status(500).json({ error: "Server Error deleting semantic memory" });
  }
});

module.exports = router;
