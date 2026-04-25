const express = require('express');
const router = express.Router();
const neuralBroadcaster = require('../services/neuralBroadcasterService');
const swarmIntelligence = require('../services/swarmIntelligenceService');
const communityAgent = require('../services/communityAgentService');
const oracleSandbox = require('../services/oracleSandboxService');
const AgentResponse = require('../models/AgentResponse');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

// 📡 Neural Broadcaster
router.post('/broadcaster/build-pipeline', auth, async (req, res) => {
  try {
    const { videoId, platforms, aeoMetadata } = req.body;
    const userId = req.user.id || req.user._id;
    const pipeline = await neuralBroadcaster.buildDeploymentPipeline(userId, videoId, platforms, aeoMetadata);
    res.json({ pipeline });
  } catch (err) {
    logger.error('Broadcaster API error', { error: err.message });
    res.status(500).json({ error: 'Pipeline build failed' });
  }
});

// 🐝 Federated Swarm
router.get('/swarm/pulse', auth, async (req, res) => {
  try {
    const { niche } = req.query;
    const pulse = await swarmIntelligence.getPulse(niche);
    res.json(pulse);
  } catch (err) {
    res.status(500).json({ error: 'Pulse fetch failed' });
  }
});

router.post('/swarm/sync', auth, async (req, res) => {
  try {
    const result = await swarmIntelligence.syncLocalBreakthrough(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// 🤖 Autonomic Community Manager
router.get('/autonomic-cm/status', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const status = await communityAgent.getStatus(userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Status fetch failed' });
  }
});

router.get('/autonomic-cm/drafts', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const drafts = await AgentResponse.find({ userId, status: 'draft' }).populate('commentId').lean();
    res.json({ drafts });
  } catch (err) {
    res.status(500).json({ error: 'Drafts fetch failed' });
  }
});

router.post('/autonomic-cm/approve', auth, async (req, res) => {
  try {
    const { responseId } = req.body;
    const userId = req.user.id || req.user._id;
    const result = await communityAgent.approveResponse(responseId, userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Approval failed' });
  }
});

router.post('/autonomic-cm/start', auth, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const status = await communityAgent.startAgent(userId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Agent start failed' });
  }
});

// 🧪 Oracle Sandbox
router.post('/oracle-sandbox/deploy', auth, async (req, res) => {
  try {
    const { projectId } = req.body;
    const userId = req.user.id || req.user._id;
    const result = await oracleSandbox.deploySandbox(userId, projectId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Sandbox deployment failed' });
  }
});

module.exports = router;
