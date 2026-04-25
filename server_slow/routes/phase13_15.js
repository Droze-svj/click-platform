const express = require('express');
const router = express.Router();
const bridgeCalibration = require('../services/bridgeCalibrationService');
const hardwareNode = require('../services/hardwareNodeService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Phase 13-15 Router: Infrastructure Sovereignty
 */

// 🛡️ Phase 13: Bridge Integrity Pulse
router.post('/bridge/pulse', auth, async (req, res) => {
  try {
    const result = await bridgeCalibration.calibrateFleet(req.user.id);
    res.json(result);
  } catch (err) {
    logger.error('Phase 13: Pulse Failed', { error: err.message });
    res.status(500).json({ error: 'Bridge calibration cycle failed' });
  }
});

// 🛠️ Phase 14: Bridge Calibration & Proxy Rotation
router.get('/bridge/health', auth, async (req, res) => {
  try {
    const index = await bridgeCalibration.getClusterStabilityIndex(req.user.id);
    res.json({ stabilityIndex: index, timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ error: 'Health scan failed' });
  }
});

// 🚢 Phase 15: Hardware Node Orchestration
router.post('/hardware/deploy', auth, async (req, res) => {
  try {
    const { nodeUri } = req.body;
    const result = await hardwareNode.deploySovereignManifest(req.user.id, nodeUri);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Hardware deployment failed' });
  }
});

router.get('/hardware/telemetry/:nodeId', auth, async (req, res) => {
  try {
    const telemetry = await hardwareNode.getHardwareTelemetry(req.params.nodeId);
    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: 'Telemetry retrieval failed' });
  }
});

module.exports = router;
