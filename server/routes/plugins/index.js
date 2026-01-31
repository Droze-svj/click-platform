// Plugin System Routes

const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roleAuth');
const { sendSuccess, sendError } = require('../../utils/response');
const pluginSystemService = require('../../services/pluginSystemService');
const logger = require('../../utils/logger');

/**
 * GET /api/plugins
 * Get all plugins
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const plugins = pluginSystemService.getAllPlugins();
    return sendSuccess(res, { plugins });
  } catch (error) {
    logger.error('Error getting plugins', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/plugins/load
 * Load plugin from file (admin only)
 */
router.post('/load', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { pluginPath } = req.body;

    if (!pluginPath) {
      return sendError(res, 'Plugin path is required', 400);
    }

    const plugin = await pluginSystemService.loadPlugin(pluginPath);
    return sendSuccess(res, plugin, 'Plugin loaded successfully');
  } catch (error) {
    logger.error('Error loading plugin', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * POST /api/plugins/register
 * Register plugin (admin only)
 */
router.post('/register', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { plugin, manifest } = req.body;

    if (!plugin || !manifest) {
      return sendError(res, 'Plugin and manifest are required', 400);
    }

    if (!pluginSystemService.validateManifest(manifest)) {
      return sendError(res, 'Invalid plugin manifest', 400);
    }

    const pluginId = pluginSystemService.registerPlugin(plugin, manifest);
    return sendSuccess(res, { pluginId }, 'Plugin registered successfully');
  } catch (error) {
    logger.error('Error registering plugin', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

/**
 * DELETE /api/plugins/:pluginId
 * Unload plugin (admin only)
 */
router.delete('/:pluginId', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { pluginId } = req.params;

    await pluginSystemService.unloadPlugin(pluginId);
    return sendSuccess(res, null, 'Plugin unloaded successfully');
  } catch (error) {
    logger.error('Error unloading plugin', { error: error.message });
    return sendError(res, error.message, 500);
  }
});

module.exports = router;
