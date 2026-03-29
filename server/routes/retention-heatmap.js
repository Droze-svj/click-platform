/**
 * server/routes/retention-heatmap.js
 * Pre-export Predictive Retention Heatmap API.
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { analyzeRetention, summarizeRetention } = require('../services/retentionHeatmapService')

// POST /api/retention-heatmap/analyze — Score the timeline for retention drops
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { segments = [], effects = [], captions = [], duration = 60 } = req.body
    const heatmap = analyzeRetention(segments, effects, captions, duration)
    const summary = summarizeRetention(heatmap)
    res.json({ heatmap, summary })
  } catch (err) {
    console.error('[RetentionHeatmap] error:', err)
    res.status(500).json({ error: 'Failed to analyze retention' })
  }
})

module.exports = router
