const express = require('express');
const router = express.Router();
const remediation = require('../services/remediationService');
const styleDNA = require('../services/styleDNAMiningService');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');

// 🛸 Phase 16: Autonomous Remediation Loop
router.post('/remediation/process', auth, asyncHandler(async (req, res) => {
  // String()-cast + ObjectId-validate (a raw object would be a NoSQL-operator
  // injection into the Mixed-typed comment/entityId filters downstream).
  const contentId = String(req.body.contentId || '');
  const mongoose = require('mongoose');
  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    return res.status(400).json({ error: 'Valid contentId is required' });
  }
  // IDOR guard: remediation re-renders and OVERWRITES the Content (processedFile
  // url/status/metadata) via an unscoped findById — only allow the caller's own.
  const Content = require('../models/Content');
  const ids = [req.user?._id, req.user?._id?.toString(), req.user?.id].filter(Boolean);
  const owned = await Content.findOne({ _id: contentId, userId: { $in: ids } }).select('_id').lean();
  if (!owned) return res.status(404).json({ error: 'Content not found' });
  const result = await remediation.processAutonomousRemediation(req.user._id, contentId);
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
