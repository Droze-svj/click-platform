// AI Director service — Slice 1.
//
// Generates 2–3 distinct, creative edit DIRECTIONS for a video by combining:
//   1. The video's real transcript + word timings + duration + stored
//      silence/scene data (no FFmpeg here — this only PLANS).
//   2. The creator's LEARNED style (UserStyleProfile.topPerformers) and their
//      active performance blueprint (continuousLearningService.getActiveBlueprint).
//   3. Claude Opus 4.8 with adaptive thinking + high effort.
//
// Hard rule (owner's #1): everything injected is REAL (from the DB). Cold-start
// users with no profile/blueprint simply get those sections omitted — we never
// invent preferences, and we never fabricate a plan. If Claude can't be reached
// or its output can't be parsed, we return an honest { ok:false, error }.
//
// NOTE on detection helpers: aiVideoEditingService does NOT export
// detectSilencePeriods / detectSceneChanges / detectKeyMoments (verified in its
// module.exports), and they require a local file + FFmpeg. So this service does
// not re-implement them — it uses the transcript + any silence/scene data
// already stored on the Content doc (content.metadata). When no silence data is
// available, the prompt instructs Claude to make NO silence-based cuts.

const Content = require('../models/Content');
const UserStyleProfile = require('../models/UserStyleProfile');
const EditPlanMemory = require('../models/EditPlanMemory');
const { getActiveBlueprint } = require('./continuousLearningService');
const anthropicAI = require('../utils/anthropicAI');
const logger = require('../utils/logger');

const MODEL = 'claude-opus-4-8';
const MAX_DIRECTIONS = 3;

// Allowed step types — kept in sync with the AI Director schema below and with
// how client/utils/applySuggestion.ts consumes them.
const STEP_TYPES = new Set([
  'cut', 'broll', 'hook', 'transition', 'audio', 'effect', 'caption', 'color', 'pacing', 'cta',
]);

/**
 * Summarize a creator's top-performing picks for one weighted facet into a
 * short human-readable line. Returns '' when there's nothing to report.
 */
function summarizeFacet(profile, weightedFacet, label) {
  if (!profile || typeof profile.topPerformers !== 'function') return '';
  let rows = [];
  try {
    rows = profile.topPerformers(weightedFacet, 3) || [];
  } catch (_) {
    return '';
  }
  if (!rows.length) return '';
  const parts = rows
    .filter((r) => r && r.key)
    .map((r) => {
      const score = typeof r.performanceScore === 'number' ? r.performanceScore.toFixed(2) : 'n/a';
      const n = r.sampleSize || 0;
      return `${r.key} (perf ${score}, n=${n})`;
    });
  if (!parts.length) return '';
  return `${label}: ${parts.join('; ')}`;
}

/**
 * Build the learned-style section from the user's UserStyleProfile. Returns ''
 * for cold-start users. We load WITHOUT .lean() because topPerformers is an
 * instance method.
 */
async function buildStyleSection(userId) {
  if (!userId) return '';
  let profile = null;
  try {
    profile = await UserStyleProfile.findOne({ userId });
  } catch (err) {
    logger.warn('[AIDirector] UserStyleProfile load failed', { error: err?.message });
    return '';
  }
  if (!profile) return '';

  const lines = [
    summarizeFacet(profile, 'weightedHooks', 'Top hooks'),
    summarizeFacet(profile, 'weightedCaptionStyles', 'Top caption styles'),
    summarizeFacet(profile, 'weightedColorGrades', 'Top color grades'),
    summarizeFacet(profile, 'weightedTransitions', 'Top transitions'),
    summarizeFacet(profile, 'weightedPacing', 'Top pacing'),
    summarizeFacet(profile, 'weightedVoiceTones', 'Top voice tones'),
  ].filter(Boolean);

  if (!lines.length) return '';
  return [
    "CREATOR'S LEARNED STYLE (real, performance-weighted from their own history —",
    'bias directions toward these proven preferences):',
    ...lines.map((l) => `  - ${l}`),
  ].join('\n');
}

/**
 * Build the blueprint section from the active performance blueprint. Returns ''
 * when the user has no blueprint yet.
 */
function buildBlueprintSection(blueprint) {
  if (!blueprint || typeof blueprint !== 'object') return '';
  const lines = [];
  if (Array.isArray(blueprint.recommendedVfx) && blueprint.recommendedVfx.length) {
    lines.push(`  - Recommended VFX: ${blueprint.recommendedVfx.join(', ')}`);
  }
  if (blueprint.recommendedColorMood) {
    lines.push(`  - Recommended color mood: ${blueprint.recommendedColorMood}`);
  }
  if (blueprint.pacingStrategy) {
    lines.push(`  - Pacing strategy: ${blueprint.pacingStrategy}`);
  }
  if (blueprint.captionStyle) {
    lines.push(`  - Caption style: ${blueprint.captionStyle}`);
  }
  if (Array.isArray(blueprint.failingPatterns) && blueprint.failingPatterns.length) {
    lines.push(`  - AVOID these failing patterns (they consistently underperform for this creator): ${blueprint.failingPatterns.join(' | ')}`);
  }
  if (!lines.length) return '';
  return [
    "CREATOR'S ACTIVE PERFORMANCE BLUEPRINT (real, learned from their analytics):",
    ...lines,
  ].join('\n');
}

/**
 * Build the "AVOID repeating these recent directions" section from the user's
 * EditPlanMemory. Returns '' when there's no recent history (cold start). We
 * never fabricate history — each line is a real, previously-generated
 * direction's signature.
 */
function buildAvoidSection(recent) {
  if (!Array.isArray(recent) || !recent.length) return '';
  const lines = recent.map((r, i) => {
    const sig = r.signature || {};
    const parts = [];
    if (sig.hookTextHash) parts.push('has a hook');
    if (sig.colorGrade) parts.push(`color "${sig.colorGrade}"`);
    if (Array.isArray(sig.transitionSet) && sig.transitionSet.length) {
      parts.push(`transitions [${sig.transitionSet.join(', ')}]`);
    }
    if (sig.pacing) parts.push(`pacing "${sig.pacing}"`);
    if (Array.isArray(sig.vfxSet) && sig.vfxSet.length) {
      parts.push(`vfx [${sig.vfxSet.join(', ')}]`);
    }
    if (sig.narrativeStructure) parts.push(`structure ${sig.narrativeStructure}`);
    const summary = parts.length ? ` — ${parts.join('; ')}` : '';
    return `  ${i + 1}. "${r.title || sig.title || 'Untitled'}"${summary}`;
  });
  return [
    'AVOID REPEATING THESE RECENT DIRECTIONS (already generated for this creator):',
    ...lines,
    'Your new directions MUST be MEANINGFULLY DIFFERENT from every entry above —',
    'pick a different hook angle, color mood, pacing, transition mix, or narrative',
    'structure. Do NOT reproduce any of the signatures listed above.',
  ].join('\n');
}

/**
 * Read silence ranges stored on the Content doc, if any. We do NOT run FFmpeg
 * here. Shape mirrors detectSilencePeriods output ({ start, end }).
 */
function readStoredSilence(content) {
  const meta = content.metadata || {};
  const candidates = [
    meta.silencePeriods,
    meta.silenceSegments,
    meta.silence,
    meta.analysis?.silenceSegments,
  ];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c
        .map((s) => ({
          start: Number(s.start ?? s.from ?? s[0]),
          end: Number(s.end ?? s.to ?? s[1]),
        }))
        .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start);
    }
  }
  return [];
}

/** Read stored scene-change timestamps, if any. */
function readStoredScenes(content) {
  const meta = content.metadata || {};
  const candidates = [meta.sceneChanges, meta.sceneTimes, meta.scenes, meta.analysis?.sceneTimes];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length) {
      return c
        .map((t) => (typeof t === 'object' ? Number(t.time ?? t.start) : Number(t)))
        .filter((t) => Number.isFinite(t));
    }
  }
  return [];
}

/**
 * Build the strict system + user prompt for Claude.
 */
function buildPrompts({
  duration, resolution, niche, platform, language,
  transcriptExcerpt, wordCount, silenceRanges, sceneTimes,
  styleSection, blueprintSection, avoidSection, goals, constraints,
}) {
  const system = [
    'You are an elite short-form video editor and creative director.',
    'You design concrete, time-anchored edit plans for vertical social video.',
    'You return STRICT JSON ONLY — no prose, no markdown fences, no commentary.',
  ].join(' ');

  const hasSilence = silenceRanges.length > 0;
  const silenceText = hasSilence
    ? silenceRanges.slice(0, 40).map((s) => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}]`).join(' ')
    : '(none available)';
  const sceneText = sceneTimes.length
    ? sceneTimes.slice(0, 40).map((t) => t.toFixed(2)).join(', ')
    : '(none available)';

  const sections = [
    'Design 2–3 DISTINCT creative directions for editing THIS specific video.',
    '',
    'VIDEO FACTS (all real — never invent timestamps beyond the duration):',
    `  - Duration: ${duration.toFixed(2)} seconds`,
    `  - Resolution: ${resolution || 'unknown'}`,
    `  - Niche: ${niche || 'unspecified'}`,
    `  - Platform: ${platform || 'unspecified'}`,
    `  - Language: ${language || 'en'}`,
    `  - Transcript word count: ${wordCount}`,
    '',
    'TRANSCRIPT (excerpt):',
    transcriptExcerpt || '(no transcript text)',
    '',
    `DETECTED SILENCE RANGES (seconds): ${silenceText}`,
    `DETECTED SCENE CHANGES (seconds): ${sceneText}`,
  ];

  if (styleSection) sections.push('', styleSection);
  if (blueprintSection) sections.push('', blueprintSection);
  if (avoidSection) sections.push('', avoidSection);

  if (goals && Object.keys(goals).length) {
    sections.push('', `CREATOR GOALS: ${JSON.stringify(goals)}`);
  }
  if (constraints && Object.keys(constraints).length) {
    sections.push('', `CONSTRAINTS: ${JSON.stringify(constraints)}`);
  }

  sections.push(
    '',
    'HARD RULES:',
    hasSilence
      ? '  - Any "cut" step MUST fall within one of the DETECTED SILENCE RANGES above.'
      : '  - No silence data is available, so do NOT propose any silence-based "cut" steps.',
    `  - Never use a "time" beyond the video duration (${duration.toFixed(2)}s) or below 0.`,
    '  - The 2–3 directions must be MEANINGFULLY DIFFERENT from each other (different vibe, pacing, and step mix).',
    styleSection ? '  - Bias toward the creator\'s top-performing style shown above.' : '',
    blueprintSection ? '  - Strictly AVOID the blueprint\'s failing patterns.' : '',
    '',
    'STEP "type" must be one of: cut | broll | hook | transition | audio | effect | caption | color | pacing | cta.',
    'STEP "params" must match the type:',
    '  - hook: { "text": string, "fontSize"?: number }',
    '  - broll: { "keyword": string, "track"?: number }',
    '  - transition: { "style": string, "duration"?: number }',
    '  - cut: { "reason": string }',
    '  - audio: { "action": string }',
    '  - effect: { "name": string, "intensity"?: number }',
    '  - caption: { "style": string }',
    '  - color: { "grade": string }',
    '  - pacing: { "strategy": string }',
    '  - cta: { "text": string }',
    '',
    'Return EXACTLY this JSON shape (2–3 directions):',
    JSON.stringify({
      directions: [{
        id: 'dir-1',
        title: 'High-energy',
        vibe: 'one-line description',
        reasoning: "why this direction fits THIS video + this creator's style",
        estImpact: 'short predicted-impact note',
        steps: [{
          type: 'hook',
          time: 0,
          params: { text: '...' },
          reasoning: '...',
          confidence: 0.8,
          impact: 'high',
        }],
      }],
    }),
  );

  const userPrompt = sections.filter((l) => l !== undefined).join('\n');
  return { system, userPrompt };
}

/**
 * Clamp + validate the model output. Drops malformed steps, clamps times into
 * [0, duration], caps directions at MAX_DIRECTIONS, and stamps stable ids.
 */
function validateDirections(raw, duration) {
  if (!raw || !Array.isArray(raw.directions)) return [];
  const out = [];
  raw.directions.slice(0, MAX_DIRECTIONS).forEach((dir, di) => {
    if (!dir || typeof dir !== 'object') return;
    const steps = Array.isArray(dir.steps) ? dir.steps : [];
    const cleanSteps = [];
    steps.forEach((step, si) => {
      if (!step || typeof step !== 'object') return;
      if (!STEP_TYPES.has(step.type)) return;
      let time = Number(step.time);
      if (!Number.isFinite(time)) return; // drop steps with non-finite time
      // Clamp into [0, duration].
      if (time < 0) time = 0;
      if (duration > 0 && time > duration) time = duration;

      let confidence = Number(step.confidence);
      if (!Number.isFinite(confidence)) confidence = 0.5;
      confidence = Math.min(1, Math.max(0, confidence));

      const impact = ['low', 'medium', 'high'].includes(step.impact) ? step.impact : 'medium';

      cleanSteps.push({
        id: typeof step.id === 'string' && step.id ? step.id : `dir-${di + 1}-step-${si + 1}`,
        type: step.type,
        time,
        params: (step.params && typeof step.params === 'object') ? step.params : {},
        reasoning: typeof step.reasoning === 'string' ? step.reasoning : '',
        confidence,
        impact,
      });
    });

    out.push({
      id: typeof dir.id === 'string' && dir.id ? dir.id : `dir-${di + 1}`,
      title: typeof dir.title === 'string' ? dir.title : `Direction ${di + 1}`,
      vibe: typeof dir.vibe === 'string' ? dir.vibe : '',
      reasoning: typeof dir.reasoning === 'string' ? dir.reasoning : '',
      estImpact: typeof dir.estImpact === 'string' ? dir.estImpact : '',
      steps: cleanSteps,
    });
  });
  return out;
}

/**
 * generateEditPlan — the public entry point.
 *
 * @param {Object} args
 * @param {string} args.contentId
 * @param {string} args.userId
 * @param {Object} [args.goals]
 * @param {Object} [args.constraints]
 * @returns {Promise<{ok:true,directions:Array,meta:Object}|{ok:false,error:string}>}
 */
async function generateEditPlan({ contentId, userId, goals = {}, constraints = {} } = {}) {
  if (!anthropicAI.isConfigured()) {
    return { ok: false, error: 'AI Director needs Claude configured (ANTHROPIC_API_KEY).' };
  }
  if (!contentId) {
    return { ok: false, error: 'contentId is required.' };
  }

  // a. Load the Content doc. Not found → throw (per spec).
  const content = await Content.findById(contentId);
  if (!content) {
    throw new Error(`Content not found: ${contentId}`);
  }

  // Pull transcript + word-level timing, duration, resolution, niche/platform/lang.
  const transcript = content.captions?.text
    || (typeof content.transcript === 'string' ? content.transcript : content.transcript?.text)
    || content.metadata?.transcript
    || null;

  if (!transcript || !String(transcript).trim()) {
    return { ok: false, error: 'Add a transcript first — transcribe the video before running the AI Director.' };
  }

  const words = content.captions?.words || content.transcript?.words || [];
  const wordCount = Array.isArray(words) && words.length
    ? words.length
    : String(transcript).trim().split(/\s+/).length;

  const meta = content.metadata || {};
  const duration = Number(content.originalFile?.duration || meta.duration || 0) || 0;
  const resolution = meta.resolution
    || (meta.width && meta.height ? `${meta.width}x${meta.height}` : null);
  const niche = constraints.niche || goals.niche || meta.niche || null;
  const platform = constraints.platform || goals.platform || meta.platform || null;
  const language = content.language || meta.language || 'en';

  const silenceRanges = readStoredSilence(content);
  const sceneTimes = readStoredScenes(content);

  const transcriptExcerpt = String(transcript).length > 2800
    ? `${String(transcript).slice(0, 2800)}\n[...truncated]`
    : String(transcript);

  // b. Learning context — REAL data only; omit on cold start.
  const styleSection = await buildStyleSection(userId);
  let blueprint = null;
  try {
    blueprint = await getActiveBlueprint(userId);
  } catch (err) {
    logger.warn('[AIDirector] getActiveBlueprint failed', { error: err?.message });
  }
  const blueprintSection = buildBlueprintSection(blueprint);

  // Edit-plan memory — the user's recent direction fingerprints, so we can tell
  // Claude what NOT to repeat. Best-effort: a memory read failure must not stop
  // a plan from being generated.
  let recent = [];
  try {
    recent = await EditPlanMemory.recentFingerprints(userId, 12);
  } catch (err) {
    logger.warn('[AIDirector] recentFingerprints load failed', { error: err?.message });
  }
  const recentSet = new Set(recent.map((r) => r.fingerprint).filter(Boolean));
  const avoidSection = buildAvoidSection(recent);

  // c. Build prompts.
  const { system, userPrompt } = buildPrompts({
    duration, resolution, niche, platform, language,
    transcriptExcerpt, wordCount, silenceRanges, sceneTimes,
    styleSection, blueprintSection, avoidSection, goals, constraints,
  });

  // d. Call Claude.
  const result = await anthropicAI.generateJSON(userPrompt, { system, model: MODEL, maxTokens: 16000 });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  const directions = validateDirections(result.data, duration);
  if (!directions.length) {
    return { ok: false, error: 'The AI Director did not return any usable directions. Please try again.' };
  }

  // e. Collision guard — flag (don't drop) any direction whose creative
  // fingerprint matches one we already showed this creator. We still return
  // everything; the client/logs can see which (if any) repeated.
  let repeatedCount = 0;
  directions.forEach((dir) => {
    try {
      const { fingerprint } = EditPlanMemory.fingerprintOf(dir);
      dir.meta = dir.meta || {};
      dir.meta.fingerprint = fingerprint;
      if (recentSet.has(fingerprint)) {
        dir.meta.repeatedFingerprint = true;
        repeatedCount += 1;
        logger.warn('[AIDirector] direction repeated a recent fingerprint', {
          contentId: String(contentId), directionId: dir.id, fingerprint,
        });
      }
    } catch (err) {
      logger.warn('[AIDirector] fingerprint guard failed', { error: err?.message });
    }
  });
  if (repeatedCount && repeatedCount === directions.length) {
    logger.warn('[AIDirector] ALL returned directions repeated recent fingerprints', {
      contentId: String(contentId), count: repeatedCount,
    });
  }

  // f. Persist each direction to edit-plan memory (best-effort — a memory write
  // failure must never fail the request).
  await Promise.all(directions.map(async (dir) => {
    try {
      await EditPlanMemory.recordGenerated(userId, contentId, dir);
    } catch (err) {
      logger.warn('[AIDirector] recordGenerated failed', { error: err?.message, directionId: dir.id });
    }
  }));

  // g. Return.
  return {
    ok: true,
    directions,
    meta: {
      model: MODEL,
      usedBlueprint: !!blueprint,
      usedStyleProfile: !!styleSection,
      usedMemory: recent.length > 0,
      repeatedFingerprints: repeatedCount,
      contentId: String(contentId),
    },
  };
}

module.exports = {
  generateEditPlan,
  // Exported for testing.
  validateDirections,
};
