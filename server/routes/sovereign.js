const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/response');
const sovereignLedger = require('../services/sovereignLedgerService');

const router = express.Router();

/**
 * GET /api/sovereign/ledger
 * Get recent decision audit trail from the Sovereign Ledger
 */
router.get('/ledger', auth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const audits = sovereignLedger.getRecentAudits(limit);
  const state = sovereignLedger.getLedgerState();

  sendSuccess(res, 'Sovereign Ledger retrieved', 200, {
    audits,
    state
  });
}));

/**
 * POST /api/sovereign/ingest
 * Trigger the autonomous ingestion pipeline from a URL
 */
router.post('/ingest', auth, asyncHandler(async (req, res) => {
  const { url, options } = req.body;
  const sovereignIngestion = require('../services/sovereignIngestionService');
  
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  // Trigger async ingestion
  sovereignIngestion.ingestFromUrl(req.user.id, url, options)
    .catch(err => {
      const logger = require('../utils/logger');
      logger.error('Background sovereign ingestion failed', { url, error: err.message });
    });

  sendSuccess(res, 'Sovereign ingestion pipeline triggered', 202, {
    status: 'triggered',
    url
  });
}));

/**
 * GET /api/sovereign/status
 * Get the current integrity status of the autonomous agent
 */
router.get('/status', auth, asyncHandler(async (req, res) => {
  const state = sovereignLedger.getLedgerState();
  sendSuccess(res, 'Sovereign status retrieved', 200, state);
}));

module.exports = router;
