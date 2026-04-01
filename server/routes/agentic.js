/**
 * server/routes/agentic.js
 * Autonomous Content Agent API routes.
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')
const { startAgentPipeline, getJobStatus, parseClientComment } = require('../services/agenticWorkflowService')

// POST /api/agentic/run — Start the autonomous agent pipeline (Pro+: ai_agent)
router.post('/run', authenticateToken, requireFeature('ai_agent'), async (req, res) => {
  try {
    const { videoId, goals } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await startAgentPipeline(videoId, goals || [], req.user.id)
    res.json(result)
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to start agent pipeline' })
  }
})

// GET /api/agentic/status/:jobId — Poll pipeline progress
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const job = getJobStatus(req.params.jobId)
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

    // In production: route to Sora or Veo 3 API
    res.json({
      clips: [
        { id: '1', title: description.slice(0, 40), duration, thumbnailUrl: null, videoUrl: null, provider: 'sora' },
        { id: '2', title: `${description.slice(0, 30)} (alt)`, duration, thumbnailUrl: null, videoUrl: null, provider: 'veo' },
        { id: '3', title: `${description.slice(0, 30)} (cinematic)`, duration, thumbnailUrl: null, videoUrl: null, provider: 'sora' },
      ],
      message: 'B-roll generation queued — clips will appear in Asset Library when ready',
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate B-roll' })
  }
})

module.exports = router
