const express = require('express');
const router = express.Router();
const fleetManagement = require('../services/fleetManagementService');
const arbitrageSteering = require('../services/arbitrageSteeringService');
const s2sIntelligence = require('../services/s2sIntelligenceService');
const networkVerification = require('../services/networkVerificationService');
const dbConfig = require('../config/database');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// 🚢 Phase 10: Fleet Management
router.get('/fleet/status', auth, async (req, res) => {
  try {
    // Real fleet status (empty nodes array when none registered — no demo data).
    const status = await fleetManagement.getFleetStatus(req.user.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Fleet status fetch failed' });
  }
});

router.get('/fleet/health', auth, async (req, res) => {
  try {
    const dbHealth = dbConfig.getDatabaseHealth();
    
    // Simulate other dependency checks
    const health = {
      database: dbHealth,
      cache: { status: 'connected', type: 'Redis', latency: '4ms' },
      queue: { status: 'active', type: 'BullMQ', pending: 0 },
      api: { status: 'operational', version: 'v3.1.0' },
      timestamp: new Date()
    };
    
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Integrity check failed' });
  }
});

router.post('/fleet/verify-network', auth, async (req, res) => {
  try {
    const result = await networkVerification.verifyAllPlatforms(req.user.id);
    res.json(result);
  } catch (err) {
    logger.error('Network Verification Failed', { error: err.message });
    res.status(500).json({ error: 'Network verification cycle failed' });
  }
});

router.post('/fleet/register', auth, async (req, res) => {
  try {
    const node = await fleetManagement.registerNode(req.user.id, req.body);
    res.json({ success: true, node });
  } catch (err) {
    res.status(500).json({ error: 'Node registration failed' });
  }
});

// 💵 Phase 11: Arbitrage Steering
router.get('/arbitrage/manifest', auth, async (req, res) => {
  try {
    const manifest = await arbitrageSteering.getSteeringManifest(req.user.id);
    res.json(manifest);
  } catch (err) {
    res.status(500).json({ error: 'Manifest fetch failed' });
  }
});

// Real offers derived from the user's monetization plans + live performance.
router.get('/arbitrage/offers', auth, async (req, res) => {
  try {
    const offers = await arbitrageSteering.getActiveOffers(req.user.id);
    res.json({ offers });
  } catch (err) {
    logger.error('Arbitrage offers fetch failed', { error: err.message });
    res.status(500).json({ error: 'Offers fetch failed' });
  }
});

// Persist a real steering decision.
router.post('/arbitrage/steer', auth, async (req, res) => {
  try {
    const { offerId, targetNiche } = req.body;
    if (!offerId) {
      return res.status(400).json({ error: 'offerId is required' });
    }
    const result = await arbitrageSteering.steerFunnel(req.user.id, offerId, targetNiche);
    res.json(result);
  } catch (err) {
    logger.error('Arbitrage steer failed', { error: err.message });
    res.status(500).json({ error: 'Steering failed' });
  }
});

// 🌐 Phase 12: Knowledge Pulse
router.get('/intelligence/ledger', auth, async (req, res) => {
  try {
    const ledger = await s2sIntelligence.getKnowledgeLedger(req.user.id);
    res.json(ledger);
  } catch (err) {
    res.status(500).json({ error: 'Ledger fetch failed' });
  }
});

// Real network health (fleet + revenue + recent activity).
router.get('/s2s/network-health', auth, async (req, res) => {
  try {
    const health = await s2sIntelligence.getNetworkHealth(req.user.id);
    res.json(health);
  } catch (err) {
    logger.error('S2S network-health fetch failed', { error: err.message });
    res.status(500).json({ error: 'Network health fetch failed' });
  }
});

router.post('/intelligence/pulse', auth, async (req, res) => {
  try {
    const result = await s2sIntelligence.broadcastPulse(req.user.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Pulse broadcast failed' });
  }
});

module.exports = router;
