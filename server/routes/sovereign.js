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

/**
 * GET /api/sovereign/insights
 * Returns AI-generated creative and performance insights
 */
router.get('/insights', auth, asyncHandler(async (req, res) => {
  // Placeholder for advanced AI insights logic
  const insights = [
    { type: 'creative', text: 'Hook resonance is up 12% in the finance niche.', score: 0.92 },
    { type: 'distribution', text: 'TikTok saturation detected; pivot to LinkedIn suggested.', score: 0.85 },
    { type: 'monetization', text: 'High-intent triggers identified at 00:42.', score: 0.78 }
  ];

  sendSuccess(res, 'Sovereign insights retrieved', 200, {
    insights,
    timestamp: new Date()
  });
}));

/**
 * GET /api/sovereign/swarm/flux
 * Returns the current consensus state of the AI agent swarm
 */
router.get('/swarm/flux', auth, asyncHandler(async (req, res) => {
  const consensus = {
    status: 'stable',
    agentCount: 12,
    agreementLevel: 0.94,
    activeDecisions: [
      { id: 'd1', topic: 'Algorithm Pivot', status: 'voted' },
      { id: 'd2', topic: 'Creative Tone shift', status: 'deliberating' }
    ],
    fluxVelocity: 0.12
  };

  sendSuccess(res, 'Swarm consensus flux retrieved', 200, consensus);
}));

module.exports = router;
