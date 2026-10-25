/**
 * server/routes/competitive-benchmark.js
 * Competitive Benchmarking & Growth Intelligence API routes.
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature, addTierContext } = require('../middleware/tierGate')
const logger = require('../utils/logger')
const {
  getCompetitiveBenchmarks,
  getNextWeekRecommendations,
  compareWithCompetitors
} = require('../services/competitiveBenchmarkingService')

// ── GET /api/competitive/benchmarks?platform=tiktok&timeframe=30days ──────────
// Returns user percentile, industry bands, competitor avg, gap + recommendations
router.get('/benchmarks', authenticateToken, addTierContext, async (req, res) => {
  try {
    const { platform = 'tiktok', timeframe = '30days' } = req.query
    const userId = req.user?.id || req.user?._id
    const data = await getCompetitiveBenchmarks(userId, platform, timeframe)
    res.json({ success: true, data })
  } catch (err) {
    // No invented industry bands: if the benchmark can't be computed, say so.
    logger.error('Competitive benchmarks failed', { error: err.message })
    res.status(503).json({
      success: false,
      error: 'Benchmarks are unavailable right now. Please try again later.'
    })
  }
})

// ── GET /api/competitive/next-week?platform=tiktok ────────────────────────────
// Returns a weekly content plan to beat the platform benchmark
router.get('/next-week', authenticateToken, requireFeature('creator_analytics'), async (req, res) => {
  try {
    const { platform = 'tiktok' } = req.query
    const userId = req.user?.id || req.user?._id
    const data = await getNextWeekRecommendations(userId, platform)
    res.json({ success: true, data })
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to generate weekly plan' })
  }
})

// ── POST /api/competitive/track ───────────────────────────────────────────────
// Body: { competitorUsernames: string[], platform: string }
router.post('/track', authenticateToken, requireFeature('creator_analytics'), async (req, res) => {
  try {
    const { competitorUsernames = [] } = req.body || {}
    if (!Array.isArray(competitorUsernames) || !competitorUsernames.length) return res.status(400).json({ error: 'competitorUsernames is required' })
    // Nothing ingests competitor data (see getCompetitorData) and nothing was
    // ever stored here, yet this answered 200 and the editor said "Now
    // tracking @x — their metrics will appear". Say what is true instead.
    return res.status(501).json({
      success: false,
      available: false,
      error: 'Competitor tracking is not available yet: Click has no source for other accounts\' metrics, so nothing would be collected.',
    })
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to track competitors' })
  }
})

// ── GET /api/competitive/compare?platform=tiktok ──────────────────────────────
// Returns side-by-side comparison vs tracked competitors
router.get('/compare', authenticateToken, requireFeature('creator_analytics'), async (req, res) => {
  try {
    const { platform = 'tiktok' } = req.query
    const userId = req.user?.id || req.user?._id
    const data = await compareWithCompetitors(userId, platform)
    res.json({ success: true, data })
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to compare with competitors' })
  }
})

module.exports = router
