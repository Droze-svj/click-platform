/**
 * Intelligence Factory Routes
 * ===========================
 * Handles high-fidelity content generation and persistence (Neural Archive).
 * 
 * Mount: /api/intelligence
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const logger = require('../utils/logger');
const Script = require('../models/Script');
const { generateContent } = require('../utils/googleAI');
const { costGuard } = require('../middleware/costGuard');
const { resolveTier } = require('../config/entitlements');
const {
  HOOK_FRAMEWORKS, NICHE_PLAYBOOKS, NICHE_POSTING_WINDOWS, CTA_LIBRARY,
  RETENTION_CURVES,
  getKnowledgeSlice, buildSystemPrompt, normaliseNiche, normalisePlatform,
} = require('../services/marketingKnowledge');
const SuggestionHistory = require('../models/SuggestionHistory');

// Middleware
router.use(authenticate);

/**
 * Stable JSON-serialise (sorted keys) and SHA-256 hash a candidate so that
 * `{ kind:'hook', niche:'finance', key:'data-flex' }` and the same object
 * with keys in any order produce the same hash. We use the hash as the
 * dedup primitive in SuggestionHistory.
 */
function hashCandidate(obj) {
  const sorted = Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});
  return crypto.createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

/**
 * Filter `candidates` so each user is unlikely to see the same one twice in
 * a row. Each candidate must have a stable `id` field. We look at the last
 * `windowSize` history entries for this user+kind, hash them, and skip any
 * candidate whose hash is in that set. If the resulting set is too small we
 * widen the window down to nothing so the user never gets an empty list.
 */
async function filterDuplicates({ userId, kind, candidates, minSize = 3, windowSize = 50 }) {
  if (!userId || !candidates || candidates.length === 0) return candidates || [];
  let recentHashes = new Set();
  try {
    const recent = await SuggestionHistory
      .find({ userId, kind })
      .sort({ createdAt: -1 })
      .limit(windowSize)
      .select('payloadHash')
      .lean();
    recentHashes = new Set(recent.map(r => r.payloadHash));
  } catch (err) {
    // If the dedup lookup fails (Mongo down, etc.) we still want to return
    // candidates rather than 500 — better to repeat than to break the UI.
    logger.warn('[intelligence] suggestion dedup lookup failed', { error: err.message });
    return candidates;
  }
  const hashed = candidates.map(c => ({ candidate: c, hash: hashCandidate({ kind, key: c.id, niche: c.niche || null, platform: c.platform || null }) }));
  const unseen = hashed.filter(h => !recentHashes.has(h.hash));
  if (unseen.length >= minSize) return unseen.map(h => h.candidate);

  // Not enough fresh ones: ALWAYS prefer the unseen, then backfill with the
  // already-seen extras (in their original order) only to reach minSize. The
  // previous version discarded the dedup result entirely and returned the
  // original list (seen-first), which defeated dedup exactly when it mattered.
  const seen = hashed.filter(h => recentHashes.has(h.hash));
  const kept = [...unseen, ...seen].slice(0, Math.max(minSize, unseen.length));
  return kept.map(h => h.candidate);
}

/**
 * Persist that we just emitted these candidates so future requests dedup
 * against them. Best-effort — failures are logged but not surfaced.
 */
async function recordEmissions({ userId, kind, candidates }) {
  if (!userId || !candidates || candidates.length === 0) return;
  try {
    const docs = candidates.map(c => ({
      userId,
      kind,
      payloadHash: hashCandidate({ kind, key: c.id, niche: c.niche || null, platform: c.platform || null }),
      label: c.label || c.text || c.id || '',
    }));
    await SuggestionHistory.insertMany(docs, { ordered: false });
  } catch (err) {
    logger.warn('[intelligence] suggestion history insert failed', { error: err.message });
  }
}

/**
 * POST /api/intelligence/factory/create
 *
 * Autonomous Creator orchestrator. Runs a 5-stage pipeline to produce a
 * full content manifest:
 *   1. intelligence — topic positioning, target audience, hook angles
 *   2. script       — full script with hook/body/cta and pacing markers
 *   3. refinery     — polish pass: stronger verbs, tighter cuts
 *   4. anatomy      — per-section duration breakdown for the timeline
 *   5. blueprint    — assembled final deliverable (hashtags, CTA chain,
 *                     thumbnail prompt, recommended posting window)
 *
 * Each stage uses task-aware AI routing via aiRouter:
 *   - intelligence + script + refinery → `creative` (Claude-first, falls
 *     back to Gemini) so the writing voice has character
 *   - anatomy → `json` (Gemini-first, structured output)
 *   - blueprint → `orchestration` (Claude-first, multi-step synthesis)
 *
 * The client expects `result.stages.<name>` so the response is shaped
 * exactly that way. Falls back to a single-call Gemini path if all
 * stages fail, so a degraded answer always reaches the user.
 */
router.post('/factory/create', costGuard(), async (req, res) => {
  try {
    const topic = req.body.prompt || req.body.topic;
    const platform = req.body.targetPlatform || req.body.platform || 'tiktok';
    const contentType = req.body.contentType || 'social-media';
    const style = req.body.stylePivot || req.body.style || 'BALANCED';
    const tone = req.body.tone || 'educational';
    const keywords = req.body.keywords || [];

    if (!topic) {
      return res.status(400).json({ success: false, error: 'Creative prompt (topic) is required.' });
    }

    const { aiCall, aiCallJson, safeJsonParse } = require('../utils/aiRouter');
    const { buildSystemPrompt } = require('../services/marketingKnowledge');

    const baseSystem = buildSystemPrompt({
      persona: 'script-writer',
      niche: tone,
      platform,
      stage: 'script',
      extra: `Output must be valid JSON with no preamble. The script must feel human-written, with pacing, emotional beats, and a visceral hook that lands within 2 seconds.`,
    });

    const ctx = `TOPIC: ${topic}\nPLATFORM: ${platform}\nCONTENT_TYPE: ${contentType}\nSTYLE: ${style}\nTONE: ${tone}\nKEYWORDS: ${(keywords || []).join(', ') || 'none'}`;

    // Cost guard: this route fans out into ~4 creative/orchestration AI calls
    // (maxTokens up to 900 each). Gate the worst-case spend up front so the
    // 5-stage pipeline can't be used for unmetered/abusive AI consumption.
    // Mirrors the pattern in routes/hookEnsemble.js.
    if (typeof req.assertBudget === 'function') {
      try {
        await req.assertBudget({
          provider: 'anthropic',
          model: 'claude-3-haiku-20240307',
          prompt: `${baseSystem}\n${ctx}`,
          expectedOutputTokens: 3200, // 4 calls × ~800 output tokens worst case
        });
      } catch (e) {
        if (e.statusCode === 402) {
          return res.status(402).json({ success: false, error: e.message, ...e.payload });
        }
        throw e;
      }
    }

    // Stage 1 — intelligence: position the topic + identify hook angles.
    const r1 = await aiCall(
      `${ctx}\n\nReturn JSON with this exact shape:\n{\n  "audience": "...",\n  "positioning": "...",\n  "topAngles": [{"angle":"...","trigger":"..."}]\n}\nKeep audience and positioning ≤ 80 chars each. 3 angles.`,
      { systemPrompt: baseSystem, taskKind: 'creative', temperature: 0.85, maxTokens: 700, taskType: 'autonomous-intelligence' }
    );
    logger.info('[intelligence] STAGE 1 RAW:', { text: r1.text });
    const intelligence = safeJsonParse(r1.text, { audience: '', positioning: '', topAngles: [] });

    // Stage 2 — script: full short-form script with hook/body/cta.
    const r2 = await aiCall(
      `${ctx}\n\nUsing this positioning:\n${JSON.stringify(intelligence)}\n\nReturn JSON:\n{\n  "title": "...",\n  "hook": "...",\n  "rawScript": {"hook": "...","body": ["...","...","..."],"cta": "..."},\n  "estimatedDurationSec": 30\n}\nHook must be 1 sentence, ≤ 10 words. Body: 3-5 punchy lines, ≤ 14 words each. CTA: 1 sentence.`,
      { systemPrompt: baseSystem, taskKind: 'creative', temperature: 0.9, maxTokens: 900, taskType: 'autonomous-script' }
    );
    logger.info('[intelligence] STAGE 2 RAW:', { text: r2.text });
    const script = safeJsonParse(r2.text, { title: '', hook: '', rawScript: { hook: '', body: [], cta: '' }, estimatedDurationSec: 30 });

    // Stage 3 — refinery: tighter, stronger verbs, cut weak words.
    const r3 = await aiCall(
      `Polish this script for ${platform}. Replace generic verbs, cut filler. Keep meaning identical. Return JSON:\n{"polishedHook":"...","polishedBody":["...","..."],"polishedCta":"...","improvements":["..."]}\n\nINPUT:\n${JSON.stringify(script.rawScript)}`,
      { systemPrompt: baseSystem, taskKind: 'creative', temperature: 0.6, maxTokens: 700, taskType: 'autonomous-refinery' }
    );
    logger.info('[intelligence] STAGE 3 RAW:', { text: r3.text });
    const refinery = safeJsonParse(r3.text, { polishedHook: script.rawScript?.hook || '', polishedBody: script.rawScript?.body || [], polishedCta: script.rawScript?.cta || '', improvements: [] });

    // Stage 4 — anatomy: per-section duration breakdown for timeline.
    const totalDuration = Math.max(15, Math.min(60, Number(script.estimatedDurationSec) || 30));
    const bodyLines = Array.isArray(refinery.polishedBody) ? refinery.polishedBody : [];
    const anatomy = {
      totalDuration,
      sections: [
        { name: 'Hook', start: 0, duration: Math.min(3, Math.round(totalDuration * 0.12)) },
        ...bodyLines.map((line, i) => ({
          name: `Body ${i + 1}`,
          start: 0, // filled below
          duration: 0,
          text: line,
        })),
        { name: 'CTA', start: 0, duration: Math.min(5, Math.round(totalDuration * 0.18)) },
      ],
    };
    // Fill section starts/durations evenly across the body.
    const fixedDuration = anatomy.sections[0].duration + anatomy.sections[anatomy.sections.length - 1].duration;
    const bodyTotal = Math.max(1, totalDuration - fixedDuration);
    const perBody = bodyTotal / Math.max(1, bodyLines.length);
    let cursor = anatomy.sections[0].duration;
    for (let i = 1; i < anatomy.sections.length - 1; i++) {
      anatomy.sections[i].start = cursor;
      anatomy.sections[i].duration = Math.round(perBody);
      cursor += anatomy.sections[i].duration;
    }
    anatomy.sections[anatomy.sections.length - 1].start = cursor;

    // Stage 5 — blueprint: final deliverable (hashtags, CTA chain, thumb).
    const r5 = await aiCall(
      `${ctx}\n\nFINAL SCRIPT:\nHook: ${refinery.polishedHook}\nBody: ${(refinery.polishedBody || []).join(' | ')}\nCTA: ${refinery.polishedCta}\n\nReturn JSON:\n{\n  "hashtags": ["#...","#...","#..."],\n  "ctaChain": ["...","..."],\n  "thumbnailPrompt": "...",\n  "postingWindow": "Tue 7pm",\n  "resonanceScore": 87,\n  "totalDuration": ${totalDuration}\n}\n7 hashtags, 2 CTA variants, 1 visual thumbnail prompt, 1 best posting window, score 60-95.`,
      { systemPrompt: baseSystem, taskKind: 'orchestration', temperature: 0.5, maxTokens: 700, taskType: 'autonomous-blueprint' }
    );
    logger.info('[intelligence] STAGE 5 RAW:', { text: r5.text });
    // On parse failure, resonanceScore is null (not a fabricated 75) so the
    // client can render "analysis unavailable" instead of a fake number.
    const blueprint = safeJsonParse(r5.text, { hashtags: [], ctaChain: [], thumbnailPrompt: '', postingWindow: '', resonanceScore: null, totalDuration });

    // Compose stage map the client expects. Also keep a flat manifest
    // for backwards compatibility with older consumers.
    const data = {
      stages: {
        intelligence,
        script: { ...script, polished: refinery },
        refinery,
        anatomy,
        blueprint,
      },
      // Flat compatibility shape — old saved manifests used this.
      hooks: [{ text: refinery.polishedHook || script.hook, trigger: intelligence.topAngles?.[0]?.trigger || 'curiosity' }],
      script: [refinery.polishedHook, ...(refinery.polishedBody || []), refinery.polishedCta].filter(Boolean).join('\n'),
      cta: refinery.polishedCta ? [refinery.polishedCta] : [],
      hashtags: blueprint.hashtags || [],
      // Preserve null (analysis unavailable) — don't coerce to a fabricated 75.
      resonanceScore: (blueprint.resonanceScore === null || blueprint.resonanceScore === undefined)
        ? null
        : blueprint.resonanceScore,
    };

    logger.info('[intelligence] Autonomous manifest produced', {
      userId: req.user?.id,
      topic: topic.slice(0, 80),
      score: data.resonanceScore,
    });

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Forge Factory creation error', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, error: `Forge synthesis failed: ${error.message}` });
  }
});

/**
 * POST /api/intelligence/factory/save
 * Saves a generated manifest to the Neural Archive.
 */
router.post('/factory/save', async (req, res) => {
  try {
    const { manifest, topic, platform } = req.body;
    
    const newScript = new Script({
      userId: req.user.id,
      title: `${topic || 'Untitled'} - ${platform}`,
      type: 'social-media',
      topic: topic,
      script: manifest.script,
      metadata: {
        hashtags: manifest.hashtags,
        hooks: manifest.hooks, // We'll store hooks in metadata or extend the schema
      },
      status: 'completed'
    });

    await newScript.save();
    res.json({ success: true, data: newScript });
  } catch (error) {
    logger.error('Forge Factory save error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Failed to archive manifest.' });
  }
});

/**
 * GET /api/intelligence/factory/history
 * Retrieves the last 10 manifest manifests from the Neural Archive.
 */
router.get('/factory/history', async (req, res) => {
  // Dev users have a non-ObjectId userId (e.g. 'dev-user-123') and Supabase
  // users have UUIDs — both throw Mongoose CastError on Script.find. Detect
  // both shapes and short-circuit to an empty list.
  const mongoose = require('mongoose');
  const userId = req.user._id || req.user.id;
  const isDevUser = typeof userId === 'string' && userId.startsWith('dev-');
  const isMongoId = mongoose.Types.ObjectId.isValid(String(userId));
  if (isDevUser || !isMongoId) {
    return res.json({ success: true, data: [] });
  }
  try {
    const history = await Script.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Forge Factory history error', { error: error.message, userId });
    // Degrade rather than 500 — empty history is the right UX when DB throws.
    res.json({ success: true, data: [], degraded: true });
  }
});

// ── Niche intelligence ────────────────────────────────────────────────────
//
// The next set of routes serve the marketing-intelligence UIs (NicheStrategy
// Panel, MarketingStrategistChat, etc). All data is sourced from the
// curated playbooks in marketingKnowledge.js — that's our "unlimited
// knowledge" anchor — and the strategist chat layers Gemini on top with a
// system prompt that already embeds niche + platform best practices.

const NICHE_LABELS = {
  health: 'Health & Wellness',
  finance: 'Finance & Investing',
  education: 'Education & Learning',
  technology: 'Technology & Software',
  lifestyle: 'Lifestyle & Aesthetics',
  business: 'Business & Operators',
  entertainment: 'Entertainment & Comedy',
  other: 'Other / Generalist',
};

/**
 * GET /api/intelligence/niches
 * Returns the catalogue of supported niches, formatted for the niche
 * picker dropdown in NicheStrategyPanel.
 */
router.get('/niches', asyncHandler(async (req, res) => {
  const niches = Object.keys(NICHE_PLAYBOOKS).map(value => ({
    value,
    label: NICHE_LABELS[value] || value,
  }));
  res.json({ success: true, niches });
}));

/**
 * GET /api/intelligence/niche/:niche
 * Returns the playbook for one niche, mapped to the NicheInfo shape that
 * NicheStrategyPanel renders (psychology / hook patterns / archetypes /
 * CTAs / objections / posting cadence / best formats).
 */
router.get('/niche/:niche', async (req, res) => {
  try {
    const niche = normaliseNiche(req.params.niche);
    const playbook = NICHE_PLAYBOOKS[niche];
    if (!playbook) {
      return res.status(404).json({ success: false, error: 'Unknown niche' });
    }
    const cadenceWindows = NICHE_POSTING_WINDOWS[niche] || [];
    const intel = {
      niche,
      label: NICHE_LABELS[niche] || niche,
      audiencePsychology: {
        // The playbook records angles/triggers/avoid; we map them to the
        // desire/fear/trigger axes the UI renders. 'Avoid' becomes
        // top-of-mind objections to neutralise.
        core_desires: playbook.angles.slice(0, 5),
        core_fears: (playbook.avoid || []).slice(0, 5),
        buying_triggers: playbook.triggers || [],
      },
      hookPatterns: HOOK_FRAMEWORKS.slice(0, 5).map(h => h.example),
      contentArchetypes: playbook.angles,
      ctaPatterns: [
        ...CTA_LIBRARY.save.slice(0, 1),
        ...CTA_LIBRARY.follow.slice(0, 1),
        ...CTA_LIBRARY.share.slice(0, 1),
      ],
      topObjections: playbook.avoid || [],
      postingCadence: {
        optimal_days: cadenceWindows.map(w => w.label),
        reasons: `Best windows in the creator's local timezone: ${cadenceWindows.map(w => `${w.start}:00–${w.end}:00 (${w.label})`).join('; ')}.`,
      },
      bestFormats: {
        tiktok: ['9:16 vertical', '15–34s', 'Burned captions', '1 idea per clip'],
        instagram: ['Reels 9:16', '7–15s for replays', 'Bold caption pill', 'Open-ended CTA'],
        youtube_shorts: ['9:16, ~50s', '#Shorts first tag', 'Lower-third subtitles'],
      },
    };
    res.json({ success: true, intel });
  } catch (error) {
    logger.error('[intelligence] /niche failed', { error: error.message, niche: req.params.niche });
    res.status(500).json({ success: false, error: 'Niche playbook lookup failed.' });
  }
});

/**
 * GET /api/intelligence/niche/:niche/hooks
 * Returns the hook framework library, optionally limited by `count`. Each
 * entry is shaped { type, label, description } for the panel UI.
 */
router.get('/niche/:niche/hooks', async (req, res) => {
  try {
    const niche = normaliseNiche(req.params.niche);
    const count = Math.max(1, Math.min(parseInt(req.query.count, 10) || 5, HOOK_FRAMEWORKS.length));
    const userId = req.user?._id || req.user?.id;

    // Anti-repetition: filter against the user's recent hook emissions.
    const allCandidates = HOOK_FRAMEWORKS.map(h => ({
      id: h.id,
      type: h.id,
      label: h.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: h.pattern,
      example: h.example,
      niche,
    }));
    const filtered = await filterDuplicates({
      userId,
      kind: 'hook-framework',
      candidates: allCandidates,
      minSize: count,
      windowSize: HOOK_FRAMEWORKS.length, // window covers full set so we cycle through cleanly
    });
    const picked = filtered.slice(0, count);
    await recordEmissions({ userId, kind: 'hook-framework', candidates: picked });

    res.json({ success: true, niche, hookTypes: picked });
  } catch (error) {
    logger.error('[intelligence] /niche/hooks failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Hook lookup failed.' });
  }
});

/**
 * GET /api/intelligence/strategist/tips?niche=...&platform=...&count=3
 * Returns niche/platform-specific quick tips for the strategist sidebar.
 * Synthesised from the playbook's angles + the platform's hook window /
 * caption guidance — no LLM call required.
 */
router.get('/strategist/tips', async (req, res) => {
  try {
    const niche = normaliseNiche(req.query.niche);
    const platform = normalisePlatform(req.query.platform);
    const count = Math.max(1, Math.min(parseInt(req.query.count, 10) || 3, 8));
    const userId = req.user?._id || req.user?.id;
    const slice = getKnowledgeSlice({ niche, platform, stage: 'edit' });

    // Build the candidate pool from angles + retention rules + platform tactics.
    const angles = (slice.nichePlaybook.angles || []).map((angle, i) => ({
      id: `angle:${niche}:${i}`,
      kind: 'angle',
      title: 'Try this angle',
      tip: angle,
      niche, platform,
    }));
    const retention = (RETENTION_CURVES['short-form'] || []).map((r, i) => ({
      id: `retention:${i}`,
      kind: 'retention',
      title: r.mark,
      tip: r.rule,
      niche, platform,
    }));
    const platformTips = [
      { id: `platform:${platform}:hook`,    kind: 'platform', title: `${platform.toUpperCase()} hook window`, tip: `You have ${slice.platformPlaybook.hookWindow} to earn the next 5 seconds.`, niche, platform },
      { id: `platform:${platform}:caption`, kind: 'platform', title: `${platform.toUpperCase()} captions`,    tip: slice.platformPlaybook.captionStyle, niche, platform },
      { id: `platform:${platform}:cta`,     kind: 'platform', title: `${platform.toUpperCase()} CTA`,         tip: slice.platformPlaybook.cta, niche, platform },
    ];
    const candidates = [...angles, ...retention, ...platformTips];

    const filtered = await filterDuplicates({
      userId,
      kind: 'strategist-tip',
      candidates,
      minSize: count,
      windowSize: 30,
    });
    const picked = filtered.slice(0, count);
    await recordEmissions({ userId, kind: 'strategist-tip', candidates: picked });

    res.json({ success: true, niche, platform, tips: picked });
  } catch (error) {
    logger.error('[intelligence] /strategist/tips failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Tip generation failed.' });
  }
});

/**
 * POST /api/intelligence/strategist/ask
 * Body: { question, niche, platforms }
 * Sends the user's question to Gemini with a system prompt seeded from the
 * niche+platform playbook. Returns a structured answer plus follow-up
 * questions and any related playbook keys the UI should highlight.
 */
router.post('/strategist/ask', async (req, res) => {
  try {
    const { question, niche: rawNiche, platforms = [] } = req.body || {};
    if (!question || typeof question !== 'string' || question.length > 1500) {
      return res.status(400).json({ success: false, error: 'Question is required (max 1500 chars).' });
    }
    const niche = normaliseNiche(rawNiche);
    const platform = normalisePlatform(Array.isArray(platforms) ? platforms[0] : platforms);
    const userId = req.user?._id || req.user?.id;

    // Route through the marketing brain: Claude-first (with LIVE web search so
    // "what's trending now" questions are real + cited) and an automatic Gemini
    // fallback inside the service. Response shape is preserved exactly.
    const { askStrategist } = require('../services/marketingBrainService');
    const brain = await askStrategist({ userId, question, niche, platform, language: 'en', tier: resolveTier(req.user) });

    if (!brain.ok) {
      return res.status(503).json({ success: false, error: brain.error });
    }

    res.json({
      success: true,
      answer: brain.answer,
      followUps: brain.followUps,
      relatedPlaybooks: brain.relatedPlaybooks,
      niche: brain.niche,
      platform: brain.platform,
      // Additive: source + citations let the UI show provenance for live claims.
      // Existing clients ignore unknown fields, so the shape stays compatible.
      source: brain.source,
      citations: brain.citations || [],
    });
  } catch (error) {
    logger.error('[intelligence] /strategist/ask failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Strategist call failed. Try again in a moment.' });
  }
});

/**
 * POST /api/intelligence/strategist/variants
 * Body: { baseHook, niche, platform }
 *
 * Returns 3 hook variants of the same idea, each anchored to a different
 * psychological trigger (curiosity / authority / FOMO / social-proof / etc).
 * The user picks one in the UI; the picked variant gets recorded to their
 * weightedHooks profile so the model biases toward what they actually use.
 */
router.post('/strategist/variants', async (req, res) => {
  try {
    const { baseHook, niche: rawNiche, platform: rawPlatform } = req.body || {};
    if (!baseHook || typeof baseHook !== 'string' || baseHook.length < 4 || baseHook.length > 600) {
      return res.status(400).json({ success: false, error: 'baseHook is required (4-600 chars).' });
    }
    const niche = normaliseNiche(rawNiche);
    const platform = normalisePlatform(rawPlatform);
    const userId = req.user?._id || req.user?.id;

    const system = buildSystemPrompt({
      persona: 'hook-writer',
      niche, platform, stage: 'script',
      language: 'en',
      extra:
        '\nGenerate exactly 3 hook variants of the same core idea, each rooted in a different ' +
        'psychological trigger. Allowed triggers: curiosity-gap, authority, FOMO, social-proof, ' +
        'shock, value-tease, enemy-frame, before-after.\n' +
        'Constraints: each variant 6-22 words, active voice, no generic clickbait, no emojis. ' +
        'For each variant include an `id` (slug of the trigger), `framing` (the trigger label), ' +
        '`text` (the variant itself), and `why` (one sentence explaining why this framing works ' +
        'for this niche/platform).\n' +
        'Return ONLY a fenced ```json block with shape: ' +
        '{ "variants": [{ "id": "...", "framing": "...", "text": "...", "why": "..." }, ...] }',
    });
    const prompt = `${system}\n\nBASE HOOK / IDEA:\n${baseHook}\n\nReturn the JSON block only.`;

    const raw = await generateContent(prompt, { temperature: 0.85, maxTokens: 800 });
    let variants = [];
    const match = (raw || '').match(/```json\s*([\s\S]+?)```/i);
    if (match) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (Array.isArray(parsed?.variants)) variants = parsed.variants;
      } catch (parseErr) {
        logger.warn('[intelligence] /strategist/variants: JSON block malformed', {
          error: parseErr.message,
          baseHookPreview: String(req.body?.baseHook || '').slice(0, 100),
        });
        // Fall through to the deterministic fallback below.
      }
    }
    if (!Array.isArray(variants) || variants.length === 0) {
      // Fallback — synthesise three deterministic variants from HOOK_FRAMEWORKS so
      // the UI never sees an empty state when Gemini quota is hit.
      variants = HOOK_FRAMEWORKS.slice(0, 3).map(h => ({
        id: h.id,
        framing: h.id.replace(/-/g, ' '),
        text: h.example,
        why: h.pattern,
      }));
    }
    variants = variants.slice(0, 3);

    // Anti-repetition — exclude variants the user has seen recently. We hash on
    // the framing+text so the same variant text can't ride two different ids.
    const candidates = variants.map(v => ({
      id: `${v.id || v.framing}:${(v.text || '').slice(0, 60)}`,
      ...v,
    }));
    const filtered = await filterDuplicates({
      userId,
      kind: 'hook-variant',
      candidates,
      minSize: 3,
      windowSize: 25,
    });
    const picked = filtered.slice(0, 3);
    await recordEmissions({ userId, kind: 'hook-variant', candidates: picked });

    res.json({ success: true, niche, platform, variants: picked });
  } catch (error) {
    logger.error('[intelligence] /strategist/variants failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Variant generation failed. Try again in a moment.' });
  }
});

module.exports = router;
