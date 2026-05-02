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
const logger = require('../utils/logger');
const Script = require('../models/Script');
const { generateContent } = require('../utils/googleAI');
const {
  HOOK_FRAMEWORKS, NICHE_PLAYBOOKS, NICHE_POSTING_WINDOWS, CTA_LIBRARY,
  PLATFORM_PLAYBOOKS, RETENTION_CURVES,
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
  let kept = hashed.filter(h => !recentHashes.has(h.hash));
  if (kept.length < minSize) {
    // Widen progressively: drop oldest half of the dedup window until we
    // have enough candidates again. As a last resort allow repeats.
    kept = hashed.slice(0, Math.max(minSize, hashed.length));
  }
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
 * Generates a high-resonance content manifest using Gemini.
 */
router.post('/factory/create', async (req, res) => {
  try {
    const { topic, platform, contentType, style, tone, keywords } = req.body;
    
    const prompt = `You are the Click Intelligence Forge, a world-class content architect.
    
    TASK: Create a high-resonance content manifest for a ${platform} ${contentType}.
    TOPIC: ${topic}
    STYLE: ${style}
    TONE: ${tone}
    KEYWORDS: ${keywords?.join(', ') || 'none'}
    
    Requirements:
    1. Provide 3 viral hooks (each with a "Psychological Trigger" description).
    2. Provide a main script/body (structured and engaging).
    3. Provide 2 strong CTAs.
    4. Provide 5 trending hashtags.
    
    Return ONLY a JSON object:
    {
      "hooks": [{"text": "...", "trigger": "..."}],
      "script": "...",
      "cta": ["...", "..."],
      "hashtags": ["...", "..."],
      "resonanceScore": 0-100
    }`;

    const response = await generateContent(prompt, { temperature: 0.8, maxTokens: 2000 });
    const manifest = JSON.parse(response || '{}');
    
    res.json({ success: true, data: manifest });
  } catch (error) {
    logger.error('Forge Factory creation error', { error: error.message, userId: req.user.id });
    res.status(500).json({ success: false, error: 'Forge synthesis failed. Signal lost.' });
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
  // Dev users have a non-ObjectId userId (e.g. 'dev-user-123') which would throw
  // Mongoose CastError on Script.find. Short-circuit to an empty list.
  const userId = req.user._id || req.user.id;
  const isDevUser = typeof userId === 'string' && userId.startsWith('dev-');
  if (isDevUser) {
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
router.get('/niches', async (req, res) => {
  const niches = Object.keys(NICHE_PLAYBOOKS).map(value => ({
    value,
    label: NICHE_LABELS[value] || value,
  }));
  res.json({ success: true, niches });
});

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

    const system = buildSystemPrompt({
      persona: 'marketing-strategist',
      niche,
      platform,
      stage: 'script',
      language: 'en',
      extra:
        '\nFormatting rules:\n' +
        '• Reply in 2-4 short paragraphs OR a tight numbered list — never both.\n' +
        '• Be specific: name tools, numbers, exact phrasing. No "engage authentically" type fluff.\n' +
        '• Close with one concrete next step the creator can do TODAY.\n' +
        '• Then return JSON in a fenced ```json block with shape: ' +
        '{ "answer": "...", "followUps": ["q1", "q2", "q3"], "relatedPlaybooks": ["growth"|"engagement"|"monetization"] }',
    });

    const prompt = `${system}\n\nCREATOR QUESTION:\n${question}\n\nReply with the prose answer first, then the JSON block.`;
    const raw = await generateContent(prompt, { temperature: 0.6, maxTokens: 1200 });

    // Parse the trailing JSON block; fall back to the raw text if Gemini
    // didn't comply with the format directive.
    let answer = (raw || '').trim();
    let followUps = [];
    let relatedPlaybooks = [];
    const jsonMatch = answer.match(/```json\s*([\s\S]+?)```/i);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (parsed?.answer) answer = parsed.answer;
        else answer = answer.replace(jsonMatch[0], '').trim();
        if (Array.isArray(parsed?.followUps)) followUps = parsed.followUps.slice(0, 4);
        if (Array.isArray(parsed?.relatedPlaybooks)) relatedPlaybooks = parsed.relatedPlaybooks.slice(0, 3);
      } catch {
        // JSON malformed — strip the block and use the prose only.
        answer = answer.replace(jsonMatch[0], '').trim();
      }
    }

    res.json({ success: true, answer, followUps, relatedPlaybooks, niche, platform });
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
      } catch { /* fall through */ }
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
