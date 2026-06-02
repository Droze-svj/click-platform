const logger = require('../utils/logger');

/**
 * Quantum ROI Predictor Service
 * Shifts focus from simple "engagement" to "Revenue-as-a-Service".
 */

/**
 * Derive a deterministic pacing/sales signal from a real edit timeline.
 * Peaks around ~28 cuts/min (tight but watchable short-form), and rewards a
 * punchy opener + a clear CTA. No random numbers.
 */
function pacingSignalFromTimeline(timelineData) {
  const clips = Array.isArray(timelineData?.clips) ? timelineData.clips
    : Array.isArray(timelineData?.segments) ? timelineData.segments
      : Array.isArray(timelineData) ? timelineData : [];
  if (clips.length === 0) {
    return { score: 70, cutsPerMin: null, hasHook: false, hasCTA: false };
  }
  const durations = clips
    .map(c => Number(c.duration) || (Number(c.endTime) - Number(c.startTime)) || 0)
    .filter(d => d > 0);
  const total = durations.reduce((a, b) => a + b, 0) || Number(timelineData?.duration) || 0;
  const cutsPerMin = total > 0 ? (clips.length / total) * 60 : null;
  let cadence = 75;
  if (cutsPerMin != null) {
    const ideal = 28;
    const spread = 18;
    cadence = 60 + 40 * Math.exp(-Math.pow(cutsPerMin - ideal, 2) / (2 * spread * spread));
  }
  const hasHook = durations[0] != null && durations[0] <= 3.5;
  const hasCTA = clips.some(c => /cta|subscribe|follow|link|buy|join|sign\s?up/i.test(
    String(c.label || c.name || c.caption || '')
  ));
  return { score: cadence, cutsPerMin, hasHook, hasCTA };
}

/**
 * Predicts the Sales Score and ROI for a given video draft from REAL signals:
 * the edit timeline's pacing/hook/CTA and the workspace's historical attributed
 * revenue per post. Falls back to an engagement-derived estimate (flagged
 * low-confidence) when there's no revenue history — never a random number.
 */
async function predictContentROI(videoId, timelineData, audiencePersona = 'General') {
  logger.info(`[ROIAgent] Forecasting ROI for ${videoId} (Persona: ${audiencePersona})...`);

  const pacing = pacingSignalFromTimeline(timelineData);
  let salesScore = pacing.score;
  if (pacing.hasHook) salesScore += 8;
  if (pacing.hasCTA) salesScore += 6;
  salesScore = Math.max(60, Math.min(100, Math.round(salesScore)));

  // Historical attributed revenue per post for this workspace (real).
  let historicalRevenuePerPost = 0;
  let engagementSignal = 0;
  let dataPoints = 0;
  try {
    const Content = require('../models/Content');
    const content = await Content.findById(videoId).select('workspaceId analytics').lean().catch(() => null);
    engagementSignal = content?.analytics?.engagement || 0;
    if (content?.workspaceId) {
      const RevenueAttribution = require('../models/RevenueAttribution');
      const rows = await RevenueAttribution.aggregate([
        { $match: { workspaceId: content.workspaceId } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$revenue.attributed', 0] } }, n: { $sum: 1 } } },
      ]).catch(() => []);
      const agg = rows[0];
      if (agg && agg.n > 0) { historicalRevenuePerPost = agg.total / agg.n; dataPoints = agg.n; }
    }
  } catch (e) {
    logger.warn('[ROIAgent] revenue lookup failed', { videoId, error: e.message });
  }

  let estimatedROI;
  let confidence;
  if (historicalRevenuePerPost > 0) {
    // Scale the workspace's real avg revenue/post by how this draft's sales
    // score compares to a neutral 75 baseline.
    estimatedROI = Math.round(historicalRevenuePerPost * (salesScore / 75));
    confidence = Math.min(0.95, 0.5 + Math.log10(dataPoints + 1) * 0.2);
  } else {
    // No attributed revenue yet — conservative engagement-derived estimate.
    estimatedROI = Math.round((engagementSignal / 1000) * 12 * (salesScore / 75));
    confidence = 0.25;
  }

  const recommendations = [];
  if (!pacing.hasHook) {
    recommendations.push({ reason: 'No punchy hook in the first 3.5s', action: 'Open on the result, then rewind to the setup', predictedLift: '+retention' });
  }
  if (!pacing.hasCTA) {
    recommendations.push({ reason: 'No clear CTA detected', action: 'Add one specific CTA near the end', predictedLift: '+conversion intent' });
  }
  if (pacing.cutsPerMin != null && pacing.cutsPerMin < 12) {
    recommendations.push({ reason: 'Pacing too slow for high conversion', action: 'Tighten dead air; aim for ~25 cuts/min', predictedLift: '+watch-through' });
  }

  return {
    videoId,
    salesScore,
    estimatedROI,
    currency: 'USD',
    audienceFit: Math.round((salesScore / 100) * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    basis: historicalRevenuePerPost > 0 ? 'historical-attribution' : 'engagement-estimate',
    signals: {
      cutsPerMin: pacing.cutsPerMin,
      hasHook: pacing.hasHook,
      hasCTA: pacing.hasCTA,
      historicalRevenuePerPost: Math.round(historicalRevenuePerPost),
      dataPoints,
    },
    recommendations,
  };
}

/**
 * Deep Audience Persona Adjustment
 * Adjusts font weights, color palettes, and pacing for specific demographics.
 */
async function getPersonaVisualAdjustments(persona) {
  const presets = {
    'Gen-Z': {
      fontFamily: 'Bebas Neue',
      vibrancy: 1.2,
      pacing: 'Rapid',
      captionStyle: 'kinetic'
    },
    'Boomer': {
      fontFamily: 'Inter',
      vibrancy: 0.9,
      pacing: 'Steady',
      captionStyle: 'static'
    }
  };

  return presets[persona] || presets['Gen-Z'];
}

module.exports = {
  predictContentROI,
  getPersonaVisualAdjustments
};
