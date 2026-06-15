/**
 * server/routes/agentic.js
 * Autonomous Content Agent API routes.
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')
const { guardOwnership } = require('../utils/ownership')
const { startAgentPipeline, getJobStatus, parseClientComment } = require('../services/agenticWorkflowService')

// POST /api/agentic/run — Start the autonomous agent pipeline (Pro+: ai_agent)
router.post('/run', authenticateToken, requireFeature('ai_agent'), async (req, res) => {
  try {
    const { videoId, goals } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    // IDOR: the pipeline does a bare Content.findById(videoId); ensure it's the
    // caller's own video before running the (autonomous, publish-capable) pipeline.
    const owned = await guardOwnership(req, res, videoId)
    if (!owned) return
    const result = await startAgentPipeline(videoId, goals || [], req.user.id)
    res.json(result)
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to start agent pipeline' })
  }
})

// GET /api/agentic/status/:jobId — Poll pipeline progress
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const job = await getJobStatus(req.params.jobId)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    res.json(job)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get job status' })
  }
})

// POST /api/agentic/parse-comment — Parse client comment into an action
router.post('/parse-comment', authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body
    if (!comment) return res.status(400).json({ error: 'comment is required' })
    const result = await parseClientComment(comment)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Failed to parse comment' })
  }
})

// POST /api/agentic/generate-broll — Request AI B-roll generation (Pro+: b_roll_ai)
router.post('/generate-broll', authenticateToken, requireFeature('b_roll_ai'), async (req, res) => {
  try {
    const { description, duration = 5 } = req.body
    if (!description) return res.status(400).json({ error: 'description is required' })

    // Real stock-footage retrieval (Pexels via stockFootageService, with its
    // own placeholder fallback when PEXELS_API_KEY is unset). Returns actual
    // clip URLs + thumbnails instead of null-filled stubs.
    const stockFootage = require('../services/stockFootageService')
    const hits = await stockFootage.searchVideos(description, { perPage: 3 }).catch(() => [])
    const clips = (hits || []).map((h, i) => ({
      id: String(i + 1),
      title: description.slice(0, 40),
      duration,
      thumbnailUrl: h.thumbnail || h.image || null,
      videoUrl: h.url || h.videoUrl || null,
      provider: h.source || h.provider || 'pexels',
    }))
    res.json({
      clips,
      message: clips.length
        ? `${clips.length} B-roll clip${clips.length === 1 ? '' : 's'} matched — add them from the Asset Library`
        : 'No matching stock footage; try a more concrete, visualisable description',
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate B-roll' })
  }
})

module.exports = router
