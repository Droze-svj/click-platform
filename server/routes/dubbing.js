/**
 * server/routes/dubbing.js
 * Generative Dubbing & Lip-Sync API routes.
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')
const { generateDubbedTrack, getDubbingStatus } = require('../services/aiGenerativeDubbingService')
const { analyzeTimelineTransitions, generateFoleyAudio } = require('../services/aiFoleyService')
const Content = require('../models/Content')

// A BCP-47-ish language tag: 2-letter primary + optional subtag. Whitelisted so
// an attacker can't smuggle a path fragment (e.g. "../../x") into the downstream
// TTS filename / provider call.
const LANG_RE = /^[a-z]{2}(-[a-z]{2,4})?$/i

// ── Dubbing ───────────────────────────────────────────────────────────────────

// POST /api/dubbing/start — Kick off a dubbing job (Elite: generative_dubbing)
router.post('/start', authenticateToken, requireFeature('generative_dubbing'), async (req, res) => {
  try {
    const { videoId, targetLanguage, voiceId, lipSyncEnabled, audioSampleUrl } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    if (!targetLanguage) return res.status(400).json({ error: 'targetLanguage is required' })
    if (!LANG_RE.test(String(targetLanguage))) {
      return res.status(400).json({ error: 'Invalid targetLanguage' })
    }

    // Ownership: the dub is generated FROM this video's transcript/title, so the
    // caller must own it. Without this scope, any entitled user could pass an
    // arbitrary/enumerated videoId and get a TTS render of another tenant's
    // private transcript (IDOR).
    if (!mongoose.isValidObjectId(videoId)) {
      return res.status(404).json({ error: 'Video not found' })
    }
    const owned = await Content.findOne({ _id: videoId, userId: req.user._id }).select('_id').lean()
    if (!owned) return res.status(404).json({ error: 'Video not found' })

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
