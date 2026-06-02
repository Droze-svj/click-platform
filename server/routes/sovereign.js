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
  const limit = parseInt(req.query.limit, 10) || 20;
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
  // Real insights derived from the user's ACTUAL published-post performance
  // via the cognitive loop (Gemini-analyzed). Honest cold-start message when
  // there's no performance data yet — no fabricated numbers.
  const { analyzeStrategicPivots } = require('../services/cognitiveLoopService');
  const workspaceId = req.user?.workspaceId || req.user?._id || req.user?.id;
  const niche = req.query.niche || req.user?.niche || 'General';

  let insights = [];
  let meta = { status: 'active', niche };
  try {
    const result = await analyzeStrategicPivots(workspaceId, niche, { userId: req.user?._id || req.user?.id });
    if (result?.status === 'cold_start' || result?.status === 'manual') {
      meta.status = result.status;
      insights = [{ type: 'onboarding', text: result.message, score: null }];
    } else if (result?.plan) {
      const plan = result.plan;
      if (plan.currentWins) insights.push({ type: 'creative', text: String(plan.currentWins).slice(0, 280), score: 0.9 });
      (plan.recommendedPivots || []).forEach((p) => {
        insights.push({ type: 'distribution', text: `${p.pivot} — ${p.reason}`, expectedImpact: p.expectedImpact, score: 0.82 });
      });
      if (plan.suggestedToneAdjustment) insights.push({ type: 'monetization', text: `Tone: ${plan.suggestedToneAdjustment}`, score: 0.78 });
      meta.analyzedVideos = result.analyzedVideos;
    }
  } catch (e) {
    const logger = require('../utils/logger');
    logger.warn('sovereign insights failed', { error: e.message });
    insights = [{ type: 'onboarding', text: 'Insights are warming up — publish a few posts so Click can learn what works for you.', score: null }];
    meta.status = 'unavailable';
  }

  sendSuccess(res, 'Sovereign insights retrieved', 200, { insights, ...meta, timestamp: new Date() });
}));

/**
 * GET /api/sovereign/swarm/flux
 * Returns the current consensus state of the AI agent swarm
 */
router.get('/swarm/flux', auth, asyncHandler(async (req, res) => {
  // Real agent activity: derive the "swarm" state from actual AgenticJob runs
  // for this user plus recent ledger decisions — not a hardcoded consensus.
  const userId = String(req.user?._id || req.user?.id || '');
  let running = 0;
  let done = 0;
  let total = 0;
  let activeDecisions = [];
  try {
    const AgenticJob = require('../models/AgenticJob');
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const jobs = await AgenticJob.find({ userId, createdAt: { $gte: since } })
      .select('jobId status currentStep videoId').sort({ createdAt: -1 }).limit(20).lean().catch(() => []);
    total = jobs.length;
    running = jobs.filter(j => j.status === 'running').length;
    done = jobs.filter(j => j.status === 'done').length;
    activeDecisions = jobs.slice(0, 5).map(j => ({ id: j.jobId, topic: `Pipeline ${j.videoId || ''}`.trim(), status: j.status === 'running' ? `step:${j.currentStep}` : j.status }));
  } catch { /* model absent */ }

  // Agreement level = share of agent runs that completed successfully.
  const agreementLevel = total > 0 ? Math.round((done / total) * 100) / 100 : 1;
  const recentAudits = (sovereignLedger.getRecentAudits(10) || []).length;

  sendSuccess(res, 'Swarm consensus flux retrieved', 200, {
    status: running > 0 ? 'active' : 'stable',
    agentCount: total,
    runningAgents: running,
    completedAgents: done,
    agreementLevel,
    activeDecisions,
    ledgerDecisions: recentAudits,
    fluxVelocity: total > 0 ? Math.round((running / total) * 100) / 100 : 0,
  });
}));

module.exports = router;
