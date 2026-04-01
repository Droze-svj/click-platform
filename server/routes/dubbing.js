/**
 * server/routes/dubbing.js
 * Generative Dubbing & Lip-Sync API routes.
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')
const { generateDubbedTrack, getDubbingStatus } = require('../services/aiGenerativeDubbingService')
const { analyzeTimelineTransitions, generateFoleyAudio } = require('../services/aiFoleyService')

// ── Dubbing ───────────────────────────────────────────────────────────────────

// POST /api/dubbing/start — Kick off a dubbing job (Elite: generative_dubbing)
router.post('/start', authenticateToken, requireFeature('generative_dubbing'), async (req, res) => {
  try {
    const { videoId, targetLanguage, voiceId, lipSyncEnabled, audioSampleUrl } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    if (!targetLanguage) return res.status(400).json({ error: 'targetLanguage is required' })

    const result = await generateDubbedTrack({ videoId, targetLanguage, voiceId, lipSyncEnabled, audioSampleUrl })
    res.json(result)
  } catch (err) {
    
    res.status(500).json({ error: 'Failed to start dubbing job' })
  }
})

// GET /api/dubbing/status/:jobId — Poll dubbing progress
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const status = await getDubbingStatus(req.params.jobId)
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: 'Failed to get dubbing status' })
  }
})

// ── Foley ─────────────────────────────────────────────────────────────────────

// POST /api/dubbing/foley/analyze — Detect foley events from timeline (Elite: ai_foley)
router.post('/foley/analyze', authenticateToken, requireFeature('ai_foley'), async (req, res) => {
  try {
    const { segments = [], effects = [] } = req.body
    const events = analyzeTimelineTransitions(segments, effects)
    res.json({ events })
  } catch (err) {
    res.status(500).json({ error: 'Failed to analyze foley events' })
  }
})

// POST /api/dubbing/foley/generate — Generate SFX for detected events (Elite: ai_foley)
router.post('/foley/generate', authenticateToken, requireFeature('ai_foley'), async (req, res) => {
  try {
    const { events = [] } = req.body
    if (!events.length) return res.status(400).json({ error: 'No events provided' })
    const audioSegments = await generateFoleyAudio(events)
    res.json({ audioSegments })
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate foley audio' })
  }
})

module.exports = router
