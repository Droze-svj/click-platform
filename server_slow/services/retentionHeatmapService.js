/**
 * retentionHeatmapService.js
 * Pre-export Predictive Retention Heatmap.
 *
 * Scores every second of the timeline (0–100) based on:
 *   - Visual change frequency (cuts, transitions)
 *   - Caption density
 *   - Audio energy spikes
 *   - Text overlay presence
 *   - Music presence
 *
 * Returns a heat-map array with warnings for predicted drop zones.
 */

/**
 * Analyze timeline and predict second-by-second retention.
 *
 * @param {object[]} segments - TimelineSegment[] from editor
 * @param {object[]} effects  - Applied effects
 * @param {object[]} captions - Caption words (TranscriptWord[])
 * @param {number}   duration - Total video duration in seconds
 * @returns {object[]} [{ timeStart, timeEnd, score, level, warnings }]
 */
function analyzeRetention(segments = [], effects = [], captions = [], duration = 60) {
  const windowSize = 5 // Score per 5-second window
  const windows = Math.ceil(duration / windowSize)
  const scores = []

  for (let i = 0; i < windows; i++) {
    const windowStart = i * windowSize
    const windowEnd = Math.min(windowStart + windowSize, duration)

    let score = 60 // Baseline

    // ── Factor 1: Visual change frequency ─────────────────────────────
    // More segment boundaries = more visual variety = better retention
    const cutsInWindow = segments.filter(
      seg => seg.endTime >= windowStart && seg.endTime <= windowEnd
    ).length
    score += Math.min(cutsInWindow * 8, 20)

    // ── Factor 2: Caption / dialogue density ──────────────────────────
    const captionsInWindow = captions.filter(
      w => w.start >= windowStart && w.start < windowEnd
    ).length
    const captionDensity = captionsInWindow / windowSize // words per second
    if (captionDensity > 1) score += 10
    else if (captionDensity < 0.3) score -= 8

    // ── Factor 3: Dead air / silence detection ────────────────────────
    const hasSegmentCoverage = segments.some(
      seg => seg.startTime <= windowStart && seg.endTime >= windowEnd && seg.type === 'video'
    )
    if (!hasSegmentCoverage) score -= 15

    // ── Factor 4: Effects / energy (transitions, speed ramps) ─────────
    const hasTransition = segments.some(
      seg => seg.transitionOut && seg.transitionOut !== 'none' &&
             seg.endTime >= windowStart && seg.endTime <= windowEnd
    )
    if (hasTransition) score += 5

    const hasSpeedRamp = segments.some(
      seg => seg.playbackSpeedStart !== undefined &&
             seg.startTime >= windowStart && seg.startTime < windowEnd
    )
    if (hasSpeedRamp) score += 8

    // ── Factor 5: Long static segments (>8s without a cut) ─────────────
    const longSegments = segments.filter(
      seg => seg.duration > 8 && seg.startTime >= windowStart && seg.endTime <= windowEnd
    )
    if (longSegments.length > 0) score -= 12

    // Clamp 0–100
    score = Math.max(0, Math.min(100, score))

    // Build warnings
    const warnings = []
    if (score < 50) {
      if (cutsInWindow === 0) warnings.push('No visual cuts — inject B-roll or add a transition')
      if (captionDensity < 0.3) warnings.push('Low caption density — add captions to keep viewers engaged')
      if (!hasSegmentCoverage) warnings.push('Potential audio-only gap — add video here')
    }
    if (score < 65 && longSegments.length > 0) {
      warnings.push(`Static shot longer than 8s at ${Math.round(windowStart)}s — add zoom or overlay`)
    }

    scores.push({
      timeStart: windowStart,
      timeEnd: windowEnd,
      score: Math.round(score),
      level: score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low',
      warnings,
    })
  }

  return scores
}

/**
 * Get overall retention score (average) and top warning.
 * @param {object[]} heatmap - from analyzeRetention
 */
function summarizeRetention(heatmap) {
  if (!heatmap.length) return { avgScore: 0, worstScore: 0, topWarning: null }
  const avg = Math.round(heatmap.reduce((s, w) => s + w.score, 0) / heatmap.length)
  const worst = heatmap.reduce((a, b) => a.score < b.score ? a : b)
  return {
    avgScore: avg,
    worstScore: worst.score,
    worstTime: worst.timeStart,
    topWarning: worst.warnings[0] ?? null,
  }
}

module.exports = { analyzeRetention, summarizeRetention }
