// Autonomous publishing — build a multi-platform plan, hold for human approval
// (default), then approve → schedule. Nothing publishes unattended unless the
// workspace opts into full_auto (and the master kill-switch still applies).

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const {
  createAutopilotPlan, approveAutopilotPlan, cancelAutopilotPlan,
} = require('../services/autopilotPlanService');

// POST /api/autopilot — draft a plan (status pending_approval unless full_auto).
router.post('/', auth, async (req, res) => {
  try {
    const { items, platforms, autonomyMode, niche, dryRun } = req.body || {};
    const result = await createAutopilotPlan(req.user._id, {
      items,
      platforms: Array.isArray(platforms) ? platforms : null,
      autonomyMode: autonomyMode === 'full_auto' ? 'full_auto' : 'human_approve',
      niche: niche || null,
      dryRun: !!dryRun,
    });
    res.json({ success: true, data: result });
  } catch (e) {
    logger.error('Autopilot plan create failed', { error: e.message });
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
});

// POST /api/autopilot/:planId/approve — human-approve gate → schedule the plan.
router.post('/:planId/approve', auth, async (req, res) => {
  try {
    res.json({ success: true, data: await approveAutopilotPlan(req.user._id, req.params.planId) });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
});

// POST /api/autopilot/:planId/cancel — cancel any not-yet-published posts.
router.post('/:planId/cancel', auth, async (req, res) => {
  try {
    res.json({ success: true, data: await cancelAutopilotPlan(req.user._id, req.params.planId) });
  } catch (e) {
    res.status(e.statusCode || 500).json({ success: false, error: e.message });
  }
});

module.exports = router;
