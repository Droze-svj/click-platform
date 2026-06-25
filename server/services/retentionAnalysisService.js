// Retention → Edit — the differentiator vidIQ can't touch. vidIQ SHOWS you a
// retention graph; this turns the curve into concrete EDIT decisions: where
// viewers leave (cut/tighten), where they rewatch (lead with / clip), and how
// strong the hook is. PURE analyzer (unit-tested); feeds the editor + auto-clip.

const logger = require('../utils/logger');

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0)); }

/**
 * PURE: analyze a retention curve [{ second, percentage }] (viewers still
 * watching) → { avgViewPercent, hookScore, dropOffs, rewatchPeaks, recommendations }.
 */
function analyzeRetention(curve = [], options = {}) {
  const pts = (Array.isArray(curve) ? curve : [])
    .map((p) => ({ s: Number(p && p.second), pct: Number(p && p.percentage) }))
    .filter((p) => Number.isFinite(p.s) && Number.isFinite(p.pct))
    .sort((a, b) => a.s - b.s);

  if (pts.length < 2) {
    return { avgViewPercent: pts[0] ? Math.round(pts[0].pct) : 0, hookScore: 0, dropOffs: [], rewatchPeaks: [], recommendations: [], reason: 'insufficient_data' };
  }

  const avgViewPercent = Math.round(pts.reduce((a, p) => a + p.pct, 0) / pts.length);

  // retention value at-or-before a given second
  const at = (sec) => {
    let v = pts[0].pct;
    for (const p of pts) { if (p.s <= sec) v = p.pct; else break; }
    return v;
  };
  const start = pts[0].pct || 100;
  const r3 = at(3);
  const hookScore = Math.round(clamp(start > 0 ? (r3 / start) * 100 : 0));

  const dropThreshold = Number(options.dropThreshold) || 5;
  const dropOffs = [];
  for (let i = 1; i < pts.length; i++) {
    const drop = pts[i - 1].pct - pts[i].pct;
    if (drop >= dropThreshold) {
      const severity = drop >= 15 ? 'high' : drop >= 8 ? 'medium' : 'low';
      dropOffs.push({
        second: pts[i].s,
        dropPct: Math.round(drop),
        severity,
        recommendation: `Viewers drop ${Math.round(drop)}% around ${pts[i].s}s — tighten or cut this beat.`,
      });
    }
  }
  dropOffs.sort((a, b) => b.dropPct - a.dropPct);

  const rewatchPeaks = [];
  for (let i = 1; i < pts.length; i++) {
    const gain = pts[i].pct - pts[i - 1].pct;
    if (gain > 2) rewatchPeaks.push({ second: pts[i].s, gainPct: Math.round(gain) });
  }
  rewatchPeaks.sort((a, b) => b.gainPct - a.gainPct);

  const recommendations = [];
  if (hookScore < 70) {
    recommendations.push({ type: 'hook', priority: 'high', message: `Weak hook — ${100 - hookScore}% leave in the first 3s. Lead with a stronger pattern interrupt or your best moment.` });
  }
  if (dropOffs[0]) recommendations.push({ type: 'cut', priority: dropOffs[0].severity, second: dropOffs[0].second, message: dropOffs[0].recommendation });
  if (rewatchPeaks[0]) recommendations.push({ type: 'lead', priority: 'medium', second: rewatchPeaks[0].second, message: `Viewers rewatch around ${rewatchPeaks[0].second}s — lead with this moment or clip it.` });
  if (avgViewPercent >= 50) recommendations.push({ type: 'strength', priority: 'low', message: `Strong average view (${avgViewPercent}%) — replicate this structure.` });

  return { avgViewPercent, hookScore, dropOffs, rewatchPeaks, recommendations };
}

/** Orchestrator: load a video's real retention curve and analyze it. */
async function getRetentionInsights(contentId, userId, options = {}) {
  const VideoMetrics = require('../models/VideoMetrics');
  let doc = null;
  try {
    const query = { contentId };
    if (userId) query.userId = userId;
    doc = await VideoMetrics.findOne(query).select('retention userId contentId platform').sort({ createdAt: -1 }).lean();
  } catch (err) {
    logger.warn('[retention] metrics query failed', { error: err.message });
  }
  if (!doc) return { available: false, reason: 'no_metrics', contentId };
  if (userId && doc.userId && String(doc.userId) !== String(userId)) {
    return { available: false, reason: 'not_found', contentId };
  }
  const analysis = analyzeRetention(doc.retention || [], options);
  return { available: (doc.retention || []).length >= 2, contentId, platform: doc.platform, ...analysis };
}

module.exports = { analyzeRetention, getRetentionInsights };
