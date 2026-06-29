const express = require('express');
const router = express.Router();
const vectorMemoryService = require('../services/vectorMemoryService');
const logger = require('../utils/logger');
const auth = require('../middleware/auth');

/**
 * @route POST /api/memory/store
 * @desc Stashes an edit preference in the vector RAG database
 */
router.post('/store', auth, async (req, res) => {
  try {
    const { text, metadata } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Missing preferred text memory" });
    }

    const success = await vectorMemoryService.storeUserMemory(req.user._id, text, metadata);
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
router.get('/query', auth, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    const results = await vectorMemoryService.queryUserMemory(req.user._id, query);
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
router.delete('/:memoryId', auth, async (req, res) => {
  try {
    const { memoryId } = req.params;
    if (!memoryId) {
      return res.status(400).json({ error: "Missing memory ID" });
    }

    const success = await vectorMemoryService.deleteUserMemory(req.user._id, memoryId);
    if (!success) {
      return res.status(404).json({ error: "Memory not found or could not be deleted" });
    }

    res.json({ message: "Memory successfully deleted.", status: 200 });
  } catch (error) {
    res.status(500).json({ error: "Server Error deleting semantic memory" });
  }
});

module.exports = router;
