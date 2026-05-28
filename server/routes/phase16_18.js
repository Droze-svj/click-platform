const express = require('express');
const router = express.Router();
const remediation = require('../services/remediationService');
const styleDNA = require('../services/styleDNAMiningService');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// 🛸 Phase 16: Autonomous Remediation Loop
router.post('/remediation/process', auth, asyncHandler(async (req, res) => {
  const { contentId } = req.body;
  const result = await remediation.processAutonomousRemediation(req.user.id, contentId);
  res.json(result);
}));

// 🧬 Phase 17: Stylistic DNA Mining
router.get('/dna/mine', auth, asyncHandler(async (req, res) => {
  const { niche, randomness } = req.query;
  if (randomness !== undefined) {
    styleDNA.setCreativeRandomness(parseFloat(randomness));
  }
  const result = await styleDNA.mineExpertStyleDNA(req.user.id, niche || 'general');
  res.json(result);
}));

module.exports = router;
