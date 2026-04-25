const express = require('express');
const router = express.Router();
const omniRouter = require('../services/omniRouterService');
const spatialMemory = require('../services/spatialMemoryService');
const aeoMetadata = require('../services/aeoMetadataService');
const ugcSynthesizer = require('../services/ugcSynthesizerService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// 📡 Omni-Model Router
router.get('/omni-router/models', auth, (req, res) => {
  res.json({ models: omniRouter.getAvailableModels() });
});

router.post('/omni-router/route', auth, async (req, res) => {
  try {
    const { scenes } = req.body;
    const manifest = await omniRouter.routeBatch(scenes);
    res.json({ manifest });
  } catch (err) {
    logger.error('Omni-Router API error', { error: err.message });
    res.status(500).json({ error: 'Routing failed' });
  }
});

// 🧠 Spatial Memory
router.post('/spatial/build', auth, async (req, res) => {
  try {
    const { projectId, script } = req.body;
    const result = await spatialMemory.buildLedger(projectId, req.user.id, script);
    res.json(result);
  } catch (err) {
    logger.error('Spatial Memory API error', { error: err.message });
    res.status(500).json({ error: 'Ledger build failed' });
  }
});

// 🌐 AEO Metadata
router.post('/aeo/build', auth, async (req, res) => {
  try {
    const { contentId, videoData, productData, creatorData } = req.body;
    const result = await aeoMetadata.buildAEOMeta(contentId || `temp_${Date.now()}`, req.user.id, {
      videoData,
      productData,
      creatorData
    });
    res.json(result);
  } catch (err) {
    logger.error('AEO Metadata API error', { error: err.message });
    res.status(500).json({ error: 'AEO build failed' });
  }
});

// 🎭 UGC Raw
router.get('/ugc/profiles', auth, (req, res) => {
  res.json({ profiles: ugcSynthesizer.getProfiles() });
});

router.post('/ugc/humanize-audio', auth, async (req, res) => {
  try {
    const { script, intensity } = req.body;
    const { humanizedScript } = await ugcSynthesizer.humanize(req.user.id, script, intensity);
    res.json({ humanizedScript });
  } catch (err) {
    res.status(500).json({ error: 'Humanization failed' });
  }
});

router.post('/ugc/degradation-manifest', auth, async (req, res) => {
  try {
    const { profile, intensity } = req.body;
    const { manifest } = await ugcSynthesizer.humanize(req.user.id, 'dummy text', intensity);
    res.json({ manifest });
  } catch (err) {
    res.status(500).json({ error: 'Manifest generation failed' });
  }
});

module.exports = router;
