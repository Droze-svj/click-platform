// White-Label Theme Routes

const express = require('express');
const auth = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/requireAdmin');
const {
  generateThemeConfig,
  generateCSSVariables,
  generateTailwindConfig,
  validateColor,
  generateThemePreview,
} = require('../../services/whiteLabelThemeService');
const asyncHandler = require('../../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../../utils/response');
const logger = require('../../utils/logger');
const router = express.Router();

/**
 * @swagger
 * /api/white-label/theme/generate:
 *   post:
 *     summary: Generate theme configuration
 *     tags: [White-Label]
 */
router.post('/generate', asyncHandler(async (req, res) => {
  const brandConfig = req.body;

  try {
    const themeConfig = generateThemeConfig(brandConfig);
    const cssVariables = generateCSSVariables(themeConfig);
    const tailwindConfig = generateTailwindConfig(themeConfig);
    const preview = generateThemePreview(themeConfig);

    sendSuccess(res, 'Theme generated', 200, {
      themeConfig,
      cssVariables,
      tailwindConfig,
      preview,
    });
  } catch (error) {
    logger.error('Generate theme error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/white-label/theme/validate-color:
 *   post:
 *     summary: Validate color
 *     tags: [White-Label]
 */
router.post('/validate-color', asyncHandler(async (req, res) => {
  const { color } = req.body;

  if (!color) {
    return sendError(res, 'Color is required', 400);
  }

  try {
    const valid = validateColor(color);
    sendSuccess(res, 'Color validated', 200, { valid, color });
  } catch (error) {
    logger.error('Validate color error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

/**
 * @swagger
 * /api/white-label/theme/preview:
 *   post:
 *     summary: Generate theme preview
 *     tags: [White-Label]
 */
router.post('/preview', asyncHandler(async (req, res) => {
  const brandConfig = req.body;

  try {
    const themeConfig = generateThemeConfig(brandConfig);
    const preview = generateThemePreview(themeConfig);

    sendSuccess(res, 'Theme preview generated', 200, preview);
  } catch (error) {
    logger.error('Generate theme preview error', { error: error.message });
    sendError(res, error.message, 500);
  }
}));

module.exports = router;






