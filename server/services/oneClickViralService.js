/**
 * One-Click Viral Service
 *
 * Single orchestrator that chains: hook analysis → smart cuts →
 * pattern-interrupt detection → magic B-roll → beat-synced speed ramps
 * → niche-tuned CTA into one staged response. The editor renders this
 * as a progress bar with each stage's output mapped to applyable
 * AIDirectorSuggestion records — the user clicks one button and gets a
 * complete recipe of edits ready to accept/reject.
 *
 * Why a separate service: the existing viralPipelineService runs an
 * actual video render. This one is read-only — it produces suggestions,
 * not a re-encoded mp4. Faster, cheaper, and the creator stays in
 * control of which fixes actually apply.
 */

const logger = require('../utils/logger');
const Content = require('../models/Content');
const { aiCallJson } = require('../utils/aiRouter');
const { buildSystemPrompt } = require('./marketingKnowledge');
const creativeTools = require('./creativeToolsService');

/**
 * Convert a moment-style record (creative tool output) into an
 * AIDirectorSuggestion the client editor can apply via useTimelineActions.
 */
function toSuggestion({ id, type, time, duration, label, description, confidence, impact }) {
  return {
    id: id || `viral-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: Number(time) || 0,
    duration: duration ? Number(duration) : undefined,
    type,
    label,
    description,
    confidence: typeof confidence === 'number' ? confidence : 0.85,
    impact: impact || 'medium',
  };
}

async function generateNicheCTA(niche, platform, language) {
  const systemPrompt = buildSystemPrompt({
    persona: 'caption-writer',
    niche,
    platform,
    stage: 'cta',
    language,
    extra: 'Output a single CTA line of 3-8 words tuned to the platform CTA library. Strict JSON only.',
  });
  const fallback = { cta: platform === 'tiktok' ? 'Save this before it disappears' : 'Drop your take in the comments' };
  const result = await aiCallJson(
    `Return JSON: { "cta": "..." } — a single CTA line for a ${platform} post in the ${niche} niche.`,
    fallback,
    { systemPrompt, taskType: 'one-click-cta', maxTokens: 80, temperature: 0.6 },
  );
  return result?.cta || fallback.cta;
}

/**
 * @param {string} contentId
 * @param {object} ctx { user, niche, platform, language }
 */
async function runOneClickViral(contentId, ctx = {}) {
  const startedAt = Date.now();
  const stages = [];

  const content = await Content.findById(contentId).lean().catch(() => null);
  if (!content) {
    return { ok: false, error: 'content-not-found', stages: [] };
  }

  const niche = ctx.niche || content.niche || ctx.user?.niche || 'business';
  const platform = ctx.platform || (content.targetPlatforms?.[0]) || 'tiktok';
  const language = ctx.language || content.language || 'en';
  const transcript = content.transcript?.words || content.transcript || [];

  const suggestions = [];

  // Stage 1 — Hook overlay (niche-aware)
  try {
    const systemPrompt = buildSystemPrompt({
      persona: 'caption-writer', niche, platform, stage: 'hook', language,
      extra: 'Return JSON only. Hook must fit the platform 3-second window.',
    });
    const hookResult = await aiCallJson(
      `Return JSON: { "hook": "..." } — a single 8-word hook line for the first 3 seconds of a ${platform} video about ${content.title || 'the topic'} in the ${niche} niche.`,
      { hook: 'Wait until you see this' },
      { systemPrompt, taskType: 'one-click-hook', maxTokens: 80, temperature: 0.7 },
    );
    if (hookResult?.hook) {
      suggestions.push(toSuggestion({
        type: 'hook',
        time: 0,
        duration: 3,
        label: 'Niche-tuned hook',
        description: hookResult.hook,
        confidence: 0.92,
        impact: 'high',
      }));
      stages.push({ name: 'hook', status: 'ok' });
    } else {
      stages.push({ name: 'hook', status: 'skipped' });
    }
  } catch (err) {
    logger.warn('[OneClickViral] hook stage failed', { error: err.message });
    stages.push({ name: 'hook', status: 'failed', error: err.message });
  }

  // Stage 2 — Pattern-interrupt detector → cut suggestions
  try {
    const interrupts = await creativeTools.patternInterruptDetector(contentId, transcript, { niche, platform });
    for (const ds of interrupts.deadSpots || []) {
      suggestions.push(toSuggestion({
        type: ds.suggestedFix === 'broll' ? 'broll' : 'cut',
        time: ds.startTime,
        duration: Math.min(ds.duration, 1.5),
        label: ds.reason,
        description: `Apply ${ds.suggestedFix} to break the pattern`,
        confidence: ds.confidence,
        impact: ds.confidence > 0.85 ? 'high' : 'medium',
      }));
    }
    stages.push({ name: 'pattern-interrupts', status: 'ok', count: interrupts.deadSpots?.length || 0, score: interrupts.score });
  } catch (err) {
    logger.warn('[OneClickViral] pattern-interrupt stage failed', { error: err.message });
    stages.push({ name: 'pattern-interrupts', status: 'failed', error: err.message });
  }

  // Stage 3 — Magic B-roll
  try {
    const broll = await creativeTools.magicBRoll(contentId, transcript, ctx.user?._id, { niche, platform, targetCount: 4 });
    for (const o of broll.overlays || []) {
      suggestions.push(toSuggestion({
        type: 'broll',
        time: o.startTime,
        duration: o.duration,
        label: `B-roll: ${o.keyword}`,
        description: o.reason || `Stock clip for "${o.keyword}"`,
        confidence: o.clipUrl ? 0.88 : 0.6,
        impact: 'medium',
      }));
    }
    stages.push({ name: 'magic-broll', status: 'ok', count: broll.overlays?.length || 0 });
  } catch (err) {
    logger.warn('[OneClickViral] broll stage failed', { error: err.message });
    stages.push({ name: 'magic-broll', status: 'failed', error: err.message });
  }

  // Stage 4 — Beat-synced speed ramps
  try {
    const ramps = await creativeTools.applySpeedRamp(contentId, { intensity: 'medium' }, ctx.user?._id);
    for (const r of ramps.rampPoints || []) {
      suggestions.push(toSuggestion({
        type: 'effect',
        time: r.atTime,
        duration: r.durationSec,
        label: 'Beat-synced punch-in',
        description: `${r.speed.toFixed(1)}x at ${r.atTime}s`,
        confidence: 0.78,
        impact: 'low',
      }));
    }
    stages.push({ name: 'beat-sync', status: 'ok', bpm: ramps.bpm, count: ramps.rampPoints?.length || 0 });
  } catch (err) {
    logger.warn('[OneClickViral] beat-sync stage failed', { error: err.message });
    stages.push({ name: 'beat-sync', status: 'failed', error: err.message });
  }

  // Stage 5 — Niche-tuned end CTA
  try {
    const cta = await generateNicheCTA(niche, platform, language);
    const totalDuration = transcript[transcript.length - 1]?.end || transcript[transcript.length - 1]?.endTime || 30;
    suggestions.push(toSuggestion({
      type: 'hook',  // hook handler renders text overlay; reuse for end CTA at endTime
      time: Math.max(0, totalDuration - 2.5),
      duration: 2.5,
      label: 'End CTA',
      description: cta,
      confidence: 0.84,
      impact: 'high',
    }));
    stages.push({ name: 'cta', status: 'ok', cta });
  } catch (err) {
    logger.warn('[OneClickViral] cta stage failed', { error: err.message });
    stages.push({ name: 'cta', status: 'failed', error: err.message });
  }

  // Persist the AI state into the Content model so the workflow tracks progress across sessions
  try {
    const aiProposals = suggestions;
    const telemetryHistory = stages;
    await Content.findByIdAndUpdate(contentId, {
      $set: {
        'metadata.aiProposals': aiProposals,
        'metadata.telemetryHistory': telemetryHistory,
        'metadata.lastAiUpdate': Date.now()
      }
    });
  } catch (err) {
    logger.error('[OneClickViral] Failed to persist AI state', { error: err.message });
  }

  return {
    ok: true,
    contentId,
    niche,
    platform,
    language,
    suggestions,
    stages,
    elapsedMs: Date.now() - startedAt,
  };
}

module.exports = { runOneClickViral };
