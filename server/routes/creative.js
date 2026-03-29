/**
 * server/routes/creative.js
 * AI Creative Tools — Auto-Reframe, Magic B-Roll, Eye Contact, Background Swap,
 * Speed Ramp, and AI Avatar route stubs wired to the creative service.
 *
 * All routes use requireFeature() so the appropriate tier gate is enforced.
 * Service implementations are in server/services/creativeToolsService.js
 */

const express = require('express')
const router = express.Router()
const { authenticateToken } = require('../middleware/auth')
const { requireFeature } = require('../middleware/tierGate')

// Lazy-load the service to keep startup fast
const getService = () => require('../services/creativeToolsService')

// ── POST /api/video/creative/auto-reframe ─────────────────────────────────────
router.post('/auto-reframe', authenticateToken, requireFeature('b_roll_ai'), async (req, res) => {
  try {
    const { videoId, aspectRatio = '9:16' } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().autoReframe(videoId, aspectRatio, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /auto-reframe error:', err.message)
    res.status(500).json({ error: 'Auto-reframe failed', detail: err.message })
  }
})

// ── POST /api/video/creative/magic-broll ─────────────────────────────────────
router.post('/magic-broll', authenticateToken, requireFeature('b_roll_ai'), async (req, res) => {
  try {
    const { videoId, transcript = [] } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().magicBRoll(videoId, transcript, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /magic-broll error:', err.message)
    res.status(500).json({ error: 'Magic B-roll failed', detail: err.message })
  }
})

// ── POST /api/video/creative/eye-contact ─────────────────────────────────────
router.post('/eye-contact', authenticateToken, requireFeature('creator_analytics'), async (req, res) => {
  try {
    const { videoId } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().fixEyeContact(videoId, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /eye-contact error:', err.message)
    res.status(500).json({ error: 'Eye contact correction failed', detail: err.message })
  }
})

// ── POST /api/video/creative/background-swap ─────────────────────────────────
router.post('/background-swap', authenticateToken, requireFeature('b_roll_ai'), async (req, res) => {
  try {
    const { videoId, backgroundUrl, blurAmount = 0 } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().swapBackground(videoId, backgroundUrl, blurAmount, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /background-swap error:', err.message)
    res.status(500).json({ error: 'Background swap failed', detail: err.message })
  }
})

// ── POST /api/video/creative/speed-ramp ──────────────────────────────────────
// Detects kinetic beat-sync points and applies speed ramps for impact
router.post('/speed-ramp', authenticateToken, requireFeature('b_roll_ai'), async (req, res) => {
  try {
    const { videoId, intensity = 'medium', preserveAudio = true } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().applySpeedRamp(videoId, { intensity, preserveAudio }, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /speed-ramp error:', err.message)
    res.status(500).json({ error: 'Speed ramp failed', detail: err.message })
  }
})

// ── POST /api/video/creative/ai-avatar ───────────────────────────────────────
// Synthesises a talking-head replica from a reference clip (Elite)
router.post('/ai-avatar', authenticateToken, requireFeature('generative_dubbing'), async (req, res) => {
  try {
    const { videoId, referenceClipUrl, script, voiceId } = req.body
    if (!videoId) return res.status(400).json({ error: 'videoId is required' })
    const result = await getService().generateAiAvatar(videoId, { referenceClipUrl, script, voiceId }, req.user.id)
    res.json(result)
  } catch (err) {
    console.error('[Creative] /ai-avatar error:', err.message)
    res.status(500).json({ error: 'AI Avatar synthesis failed', detail: err.message })
  }
})

// ── POST /api/video/creative/thumbnail ───────────────────────────────────────
// Accepts a base64 frame + style preset, returns an enhanced thumbnail URL
router.post('/thumbnail', authenticateToken, requireFeature('creative_tools'), async (req, res) => {
  try {
    const { videoId, frameDataUrl, style = 'viral', title } = req.body
    if (!videoId && !frameDataUrl) {
      return res.status(400).json({ error: 'videoId or frameDataUrl is required' })
    }
    // In production this would call a vision AI service (DALL-E, Stable Diffusion, etc.)
    // For now we return a structured job receipt so the frontend can poll
    const jobId = `thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    res.json({
      success: true,
      jobId,
      style,
      title: title ?? null,
      status: 'queued',
      estimatedSeconds: 8,
      message: `Thumbnail enhancement job queued (style: ${style})`,
    })
  } catch (err) {
    console.error('[Creative] /thumbnail error:', err.message)
    res.status(500).json({ error: 'Thumbnail generation failed', detail: err.message })
  }
})

module.exports = router
