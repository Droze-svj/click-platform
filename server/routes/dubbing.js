/**
 * server/routes/dubbing.js
 * Generative Dubbing & Lip-Sync API routes.
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')
const { generateDubbedTrack, getDubbingStatus, saveDubbedAudio } = require('../services/aiGenerativeDubbingService')
const { analyzeTimelineTransitions, generateFoleyAudio } = require('../services/aiFoleyService')
const Content = require('../models/Content')
const DubbingJob = require('../models/DubbingJob')
const { signMediaUrls } = require('../utils/mediaUrlSigner')
const { ownUploadFile } = require('../utils/ownUploadFile')
const logger = require('../utils/logger')

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
    const owned = await Content.findOne({ _id: videoId, userId: req.user._id }).select('_id originalFile.url').lean()
    if (!owned) return res.status(404).json({ error: 'Video not found' })

    // The provider dubs the real media: our own file from disk (ownership was
    // checked above), or a remote cloud-storage original by URL.
    const originalUrl = owned.originalFile?.url || ''
    const sourceFilePath = ownUploadFile(originalUrl, { requireSignature: false })
    const sourceUrl = !sourceFilePath && /^https:\/\//i.test(originalUrl) ? originalUrl : undefined

    const result = await generateDubbedTrack({ videoId, targetLanguage, voiceId, lipSyncEnabled, audioSampleUrl, sourceFilePath, sourceUrl })

    // An async provider job: remember who owns it and which language it is, so
    // the status poll can scope it and fetch the finished audio into /uploads.
    if (result && result.jobId && !result.audioUrl && !result.mock && result.ok !== false) {
      await DubbingJob.create({ jobId: String(result.jobId), userId: req.user._id, videoId, targetLanguage })
    }
    // /uploads audio must be signed or requireSignedMedia refuses to serve it.
    res.json(signMediaUrls(result))
  } catch (err) {
    res.status(500).json({ error: 'Failed to start dubbing job' })
  }
})

// GET /api/dubbing/status/:jobId — Poll dubbing progress
// Only the job's owner may poll it. When the provider reports it finished, the
// audio is copied once into /uploads/dubs and returned as a signed same-origin
// URL — the provider's own audio URL needs our API key and cannot be played.
router.get('/status/:jobId', authenticateToken, async (req, res) => {
  try {
    const job = await DubbingJob.findOne({ jobId: String(req.params.jobId), userId: req.user._id })
    if (!job) return res.status(404).json({ status: 'error', error: 'Dubbing job not found' })

    if (job.status === 'completed' && job.audioUrl) {
      return res.json(signMediaUrls({ status: 'completed', progress: 100, audioUrl: job.audioUrl }))
    }
    if (job.status === 'error') {
      return res.json({ status: 'error', progress: 0, error: job.error || 'Dubbing generation failed.' })
    }

    const status = await getDubbingStatus(job.jobId)
    if (status?.status === 'completed') {
      try {
        job.audioUrl = await saveDubbedAudio(job.jobId, job.targetLanguage)
        job.status = 'completed'
        await job.save()
        return res.json(signMediaUrls({ status: 'completed', progress: 100, audioUrl: job.audioUrl }))
      } catch (e) {
        logger.error('[dubbing] could not store finished dub', { jobId: job.jobId, error: e.message })
        return res.json({ status: 'error', progress: 0, error: 'The dub finished but its audio could not be saved. Please try again.' })
      }
    }
    if (status?.status === 'error') {
      job.status = 'error'
      job.error = status.error || 'Dubbing generation failed.'
      await job.save()
    }
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
