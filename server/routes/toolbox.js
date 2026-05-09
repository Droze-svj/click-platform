const express = require('express');
const router = express.Router();
const sovereignToolboxService = require('../services/sovereignToolboxService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /api/toolbox
 * Get all 10 Sovereign Editing Tools
 */
router.get('/', auth, (req, res) => {
  const tools = sovereignToolboxService.getTools();
  res.json({ success: true, tools });
});

/**
 * POST /api/toolbox/execute
 * Execute a specific sovereign tool
 */
router.post('/execute', auth, async (req, res) => {
  try {
    const { toolId, videoId, options } = req.body;
    const userId = req.user.id;

    if (!toolId) {
      return res.status(400).json({ success: false, error: 'toolId is required' });
    }

    const result = await sovereignToolboxService.executeTool(toolId, videoId, options, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[ToolboxRoute] Execution failed', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
