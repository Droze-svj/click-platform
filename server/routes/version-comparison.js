// Version Comparison Routes
// Enhanced side-by-side version comparison

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const { compareVersionsSideBySide, exportVersionComparison } = require('../services/versionComparisonService');
const router = express.Router();

/**
 * GET /api/versions/:entityId/compare
 * Compare two versions side-by-side
 */
router.get('/:entityId/compare', auth, asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { version1, version2, entityType = 'content' } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const comparison = await compareVersionsSideBySide(
    entityId,
    parseInt(version1),
    parseInt(version2),
    entityType
  );

  sendSuccess(res, 'Versions compared', 200, comparison);
}));

/**
 * GET /api/versions/:entityId/compare/export
 * Export version comparison for legal/compliance
 */
router.get('/:entityId/compare/export', auth, asyncHandler(async (req, res) => {
  const { entityId } = req.params;
  const { version1, version2, entityType = 'content', format = 'json' } = req.query;

  if (!version1 || !version2) {
    return sendError(res, 'Both version1 and version2 are required', 400);
  }

  const exportData = await exportVersionComparison(
    entityId,
    parseInt(version1),
    parseInt(version2),
    entityType,
    format
  );

  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html');
    res.send(exportData);
  } else if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=version-comparison-${version1}-${version2}.json`);
    res.send(exportData);
  } else {
    sendSuccess(res, 'Comparison exported', 200, { data: exportData });
  }
}));

module.exports = router;


