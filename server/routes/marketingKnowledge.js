/**
 * /api/marketing-knowledge — read-only endpoints exposing the
 * server's marketing playbooks to the client. The editor + scripts
 * pages use this to surface "what's working in your niche right now"
 * inline, with the same data that gets injected into AI prompts.
 */

const express = require('express');
const auth = require('../middleware/auth');
const {
  getKnowledgeSlice,
  buildCompactGuidance,
  HOOK_FRAMEWORKS,
  PLATFORM_PLAYBOOKS,
  NICHE_PLAYBOOKS,
  CTA_LIBRARY,
} = require('../services/marketingKnowledge');

const router = express.Router();

router.get('/slice', auth, (req, res) => {
  const { niche, platform, stage } = req.query;
  const language = req.query.language || req.language || 'en';
  const slice = getKnowledgeSlice({ niche, platform, stage, language });
  res.json({ success: true, data: slice });
});

router.get('/compact', auth, (req, res) => {
  const { niche, platform, stage } = req.query;
  const language = req.query.language || req.language || 'en';
  res.json({ success: true, data: { guidance: buildCompactGuidance({ niche, platform, stage, language }) } });
});

router.get('/hooks', (_req, res) => {
  res.json({ success: true, data: HOOK_FRAMEWORKS });
});

router.get('/platforms', (_req, res) => {
  res.json({ success: true, data: PLATFORM_PLAYBOOKS });
});

router.get('/niches', (_req, res) => {
  res.json({ success: true, data: Object.keys(NICHE_PLAYBOOKS) });
});

router.get('/ctas', (_req, res) => {
  res.json({ success: true, data: CTA_LIBRARY });
});

module.exports = router;
