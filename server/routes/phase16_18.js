const express = require('express');
const router = express.Router();
const remediation = require('../services/remediationService');
const styleDNA = require('../services/styleDNAMiningService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Phase 16-18 Router: Creative Intelligence & Evolution
 */

// 🛸 Phase 16: Autonomous Remediation Loop
router.post('/remediation/process', auth, async (req, res) => {
  try {
    const { contentId } = req.body;
    const result = await remediation.processAutonomousRemediation(req.user.id, contentId);
    res.json(result);
  } catch (err) {
    logger.error('Phase 16: Remediation Failed', { error: err.message });
    res.status(500).json({ error: 'Remediation cycle failed' });
  }
});

// 🧬 Phase 17: Stylistic DNA Mining
router.get('/dna/mine', auth, async (req, res) => {
  try {
    const { niche, randomness } = req.query;
    if (randomness !== undefined) {
        styleDNA.setCreativeRandomness(parseFloat(randomness));
    }
    const result = await styleDNA.mineExpertStyleDNA(req.user.id, niche || 'general');
    res.json(result);
  } catch (err) {
    logger.error('Phase 17: DNA Mining Failed', { error: err.message });
    res.status(500).json({ error: 'Style DNA mining failed' });
  }
});

module.exports = router;
