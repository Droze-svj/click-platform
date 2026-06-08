/**
 * marketingBrainService.js
 *
 * Click's niche-aware, always-current MARKETING BRAIN. This is the single
 * orchestrator the marketing routes call. Each function:
 *
 *   1. Resolves the user's CANONICAL niche + platform focus + goals from
 *      User.niche / UserPreferences.marketingIntelligence (set at signup).
 *   2. Builds a rich system prompt from the curated knowledge base
 *      (marketingKnowledge.buildSystemPrompt) blended with the user's REAL
 *      performance (UserStyleProfile.topPerformers via getTopPerformingPlaybook
 *      + continuousLearningService.getActiveBlueprint).
 *   3. For trend/strategy-sensitive calls, grounds the answer in the LIVE web
 *      via anthropicAI.generateJSONWithWeb (Claude's server-side web_search) so
 *      results are current AND cited. Non-trend reasoning uses generateJSON.
 *   4. CLAUDE-FIRST with a GEMINI FALLBACK: if Claude isn't configured or
 *      errors, we fall back to the existing Gemini path so the feature degrades
 *      gracefully and the response shape the client expects is preserved.
 *
 * Hard rules (owner's #1 rule): never fabricate data, never present a static
 * baseline as "live". On total failure we return an honest error; web-grounded
 * results carry their source citations.
 */

const logger = require('../utils/logger');
const anthropicAI = require('../utils/anthropicAI');
const { generateContent: geminiGenerate, isConfigured: geminiConfigured } = require('../utils/googleAI');
const { aiProfileForTier } = require('../config/aiProfiles');
const marketingKnowledge = require('./marketingKnowledge');

const {
  buildSystemPrompt,
  getTopPerformingPlaybook,
  normaliseNiche,
  normalisePlatform,
} = marketingKnowledge;

// ── Niche / platform / goal resolution ──────────────────────────────────────
//
// Canonical niche lives in two places (kept in sync at signup):
//   - User.niche
//   - UserPreferences.marketingIntelligence.niche
// Platform focus + goals live on UserPreferences.marketingIntelligence. We
// prefer an explicitly-passed niche/platform (the caller knows the active
// context, e.g. the editor's current niche) and fall back to the stored
// canonical values. Everything degrades to safe defaults so a brand-new or
// Supabase-only user still gets a coherent prompt.

/**
 * Resolve { niche, platform, goals } for a user, preferring explicit args.
 * Never throws — DB failures fall through to defaults.
 */
async function resolveContext({ userId, niche, platform } = {}) {
  let resolvedNiche = niche;
  let resolvedPlatform = platform;
  let goals = [];

  if (userId && (!resolvedNiche || !resolvedPlatform)) {
    try {
      const mongoose = require('mongoose');
      const idStr = String(userId);

      // UserPreferences.userId is a String in this codebase, so it works for
      // both ObjectId-backed and Supabase (UUID) users.
      const UserPreferences = require('../models/UserPreferences');
      const prefs = await UserPreferences.findOne({ userId: idStr }).lean();
      const mi = prefs?.marketingIntelligence || {};

      if (!resolvedNiche && mi.niche) resolvedNiche = mi.niche;
      if (!resolvedPlatform) {
        const focus = Array.isArray(mi.platformFocus) ? mi.platformFocus : [];
        if (focus.length > 0) resolvedPlatform = focus[0];
      }
      if (Array.isArray(mi.goals)) goals = mi.goals;

      // Fall back to User.niche only when prefs didn't carry one and the id is
      // a real ObjectId (legacy Mongo users).
      if (!resolvedNiche && mongoose.Types.ObjectId.isValid(idStr)) {
        const User = require('../models/User');
        const user = await User.findById(idStr).select('niche').lean();
        if (user?.niche) resolvedNiche = user.niche;
      }
    } catch (err) {
      logger.warn('[marketingBrain] resolveContext lookup failed; using defaults', {
        error: err.message, userId,
      });
    }
  }

  return {
    niche: normaliseNiche(resolvedNiche),
    platform: normalisePlatform(resolvedPlatform),
    goals: Array.isArray(goals) ? goals.filter(Boolean).slice(0, 5) : [],
  };
}

/**
 * Build the blended system prompt: curated knowledge base + the user's REAL
 * top-performing playbook + their active learning blueprint. Returns the
 * prompt string plus the realPerformance object (so callers can log/debug what
 * informed the answer). Best-effort — learning-loop failures degrade to the
 * static playbook, they never break the prompt build.
 */
async function buildBrainContext({ userId, niche, platform, language = 'en', persona, extra = '' }) {
  let topPerformers = null;
  let blueprint = null;
  let insightSummary = null;

  if (userId) {
    try {
      topPerformers = await getTopPerformingPlaybook(userId, niche, platform);
    } catch (err) {
      logger.warn('[marketingBrain] getTopPerformingPlaybook failed', { error: err.message });
    }
    try {
      const { getActiveBlueprint } = require('./continuousLearningService');
      blueprint = await getActiveBlueprint(userId);
    } catch (err) {
      logger.warn('[marketingBrain] getActiveBlueprint failed', { error: err.message });
    }
    // Unified, normalized insight summary (post performance + account/audience
    // signals) — single source of truth that reconciles the field-name
    // differences across ScheduledPost/VideoMetrics/account insights.
    try {
      const { getUserInsightSummary } = require('./insightsService');
      insightSummary = await getUserInsightSummary(userId);
    } catch (err) {
      logger.warn('[marketingBrain] getUserInsightSummary failed', { error: err.message });
    }
  }

  // Fold the active blueprint (what's actually working for this creator right
  // now) into the prompt as an explicit bias block when present.
  let blueprintExtra = '';
  if (blueprint && typeof blueprint === 'object') {
    const bits = [];
    if (blueprint.summary) bits.push(`Current winning approach: ${blueprint.summary}`);
    if (Array.isArray(blueprint.recommendations) && blueprint.recommendations.length) {
      bits.push(`Active recommendations: ${blueprint.recommendations.slice(0, 4).join(' · ')}`);
    }
    if (Array.isArray(blueprint.topHooks) && blueprint.topHooks.length) {
      bits.push(`Hooks that performed: ${blueprint.topHooks.slice(0, 4).join(' · ')}`);
    }
    if (bits.length) {
      blueprintExtra = '\n── This creator\'s live blueprint (bias toward, do not force) ──\n' + bits.join('\n');
    }
  }

  // Fold real account/audience signals into the prompt — only when we have
  // real data, never fabricated. Honest "no data yet" simply contributes
  // nothing rather than a placeholder number.
  let insightExtra = '';
  if (insightSummary && insightSummary.hasData) {
    const bits = [];
    const aud = insightSummary.audience || {};
    if (aud.totalFollowers != null) {
      const perPlat = (aud.byPlatform || [])
        .filter(p => p.available && p.followerCount != null)
        .map(p => `${p.platform}: ${p.followerCount}`);
      bits.push(`Total followers across connected accounts: ${aud.totalFollowers}${perPlat.length ? ` (${perPlat.join(', ')})` : ''}`);
    }
    const posts = insightSummary.posts || {};
    if (posts.count > 0) {
      bits.push(`Recent measured posts: ${posts.count}, avg engagement rate ${posts.avgEngagementRate}%${posts.avgRetention != null ? `, avg retention ${posts.avgRetention}%` : ''}`);
    }
    if (bits.length) {
      insightExtra = '\n── This creator\'s real audience & performance signals (ground truth) ──\n' + bits.join('\n');
    }
  }

  const system = buildSystemPrompt({
    persona: persona || 'marketing-coach',
    niche,
    platform,
    stage: 'script',
    language,
    styleProfile: userId ? { userId } : null,
    topPerformers,
    extra: `${extra}${blueprintExtra}${insightExtra}`,
  });

  return { system, realPerformance: { topPerformers, blueprint, insightSummary } };
}

/**
 * Core Claude-first / Gemini-fallback executor.
 *
 * @param {Object} cfg
 * @param {string} cfg.system          - system prompt (blended context)
 * @param {string} cfg.prompt          - user prompt (must request JSON)
 * @param {boolean} cfg.web            - enable Claude web search (trend/strategy)
 * @param {number} [cfg.maxTokens]
 * @param {number} [cfg.maxWebSearches]
 * @param {Function} cfg.normalize     - (parsedData, citations) => clientShape
 * @param {Function} cfg.geminiFallback- async () => clientShape | null
 * @param {string} [cfg.tier]          - caller's tier; scales AI depth (effort/
 *                                        tokens/web) via aiProfiles. Agency gets
 *                                        the deepest reasoning + most live web.
 * @returns {Promise<{ok:true, data, source, citations}|{ok:false, error}>}
 */
async function runClaudeFirst({ system, prompt, web = false, maxTokens = 4000, maxWebSearches = 4, normalize, geminiFallback, tier }) {
  // Scale the AI's depth to the caller's tier (when known). Higher tiers reason
  // harder (effort), can write longer (maxTokens), and ground in more live
  // sources (maxWebSearches) — same model, just more thorough. free → no live
  // web, so we honestly route it to the non-web path rather than 1 token search.
  let effectiveMaxTokens = maxTokens;
  let effectiveWebSearches = maxWebSearches;
  let effectiveWeb = web;
  if (tier != null) {
    const profile = aiProfileForTier(tier);
    effectiveMaxTokens = Math.max(maxTokens, profile.maxTokens);
    effectiveWebSearches = profile.maxWebSearches;
    effectiveWeb = web && profile.maxWebSearches > 0;
  }

  // 1) Claude path (preferred).
  if (anthropicAI.isConfigured()) {
    try {
      const result = effectiveWeb
        ? await anthropicAI.generateJSONWithWeb(prompt, { system, maxTokens: effectiveMaxTokens, maxWebSearches: effectiveWebSearches, tier })
        : await anthropicAI.generateJSON(prompt, { system, maxTokens: effectiveMaxTokens, tier });

      if (result.ok && result.data) {
        const shaped = normalize(result.data, result.citations || []);
        if (shaped) {
          return { ok: true, data: shaped, source: effectiveWeb ? 'claude+web' : 'claude', citations: result.citations || [] };
        }
      } else {
        logger.warn('[marketingBrain] Claude path returned no usable data; trying Gemini', {
          error: result.error, web,
        });
      }
    } catch (err) {
      logger.warn('[marketingBrain] Claude path threw; trying Gemini', { error: err.message, web });
    }
  }

  // 2) Gemini fallback — preserves the response shape the client expects so
  //    the feature degrades gracefully when Claude is unconfigured/erroring.
  if (typeof geminiFallback === 'function') {
    try {
      const shaped = await geminiFallback();
      if (shaped) return { ok: true, data: shaped, source: 'gemini', citations: [] };
    } catch (err) {
      logger.warn('[marketingBrain] Gemini fallback failed', { error: err.message });
    }
  }

  // 3) Honest failure — never fabricate.
  return { ok: false, error: 'The marketing brain is temporarily unavailable. Please try again shortly.' };
}

// Pull a trailing/embedded JSON object out of a Gemini text response.
function parseGeminiJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const fenced = raw.match(/```json\s*([\s\S]+?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw.trim();
  try { return JSON.parse(candidate); } catch (_) { /* fall through */ }
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(candidate.slice(first, last + 1)); } catch (_) { /* noop */ }
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * getStrategy — a current, web-grounded niche/platform strategy for the user.
 * Blends knowledge base + real performance + LIVE web trends.
 * Returns { niche, platform, strategy, source, citations }.
 */
async function getStrategy({ userId, niche, platform, goal, language = 'en', tier } = {}) {
  const ctx = await resolveContext({ userId, niche, platform });
  const { system } = await buildBrainContext({
    userId, niche: ctx.niche, platform: ctx.platform, language, persona: 'marketing-coach',
  });

  const goalLine = goal || (ctx.goals.length ? ctx.goals.join(', ') : 'grow reach and engagement');
  const prompt =
    `Using LIVE web search, build a current, specific marketing strategy for a ${ctx.niche} creator on ` +
    `${ctx.platform.toUpperCase()} whose primary goal is: ${goalLine}.\n` +
    `Ground every "current/trending" claim in something you actually find on the web RIGHT NOW — do not ` +
    `invent trends. If you cannot verify a trend, omit it.\n\n` +
    `Return ONLY valid JSON:\n` +
    `{\n  "summary": "2-3 sentence positioning for right now",\n` +
    `  "pillars": [{"title":"...","why":"...","action":"..."}],\n` +
    `  "currentTrends": [{"trend":"...","whyNow":"...","howToUse":"..."}],\n` +
    `  "nextSteps": ["...","..."]\n}\n` +
    `3-4 pillars, 2-4 currentTrends (only verifiable ones), 3 nextSteps.`;

  const result = await runClaudeFirst({
    system, prompt, web: true, maxTokens: 6000, maxWebSearches: 5, tier,
    normalize: (data, citations) => {
      if (!data || (typeof data !== 'object')) return null;
      return {
        niche: ctx.niche,
        platform: ctx.platform,
        goal: goalLine,
        strategy: {
          summary: data.summary || '',
          pillars: Array.isArray(data.pillars) ? data.pillars : [],
          currentTrends: Array.isArray(data.currentTrends) ? data.currentTrends : [],
          nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
        },
        citations,
      };
    },
    geminiFallback: async () => {
      if (!geminiConfigured) return null;
      // No live web on the Gemini path — produce a knowledge-base strategy and
      // be explicit that it's a static baseline, not "current/live" trends.
      const raw = await geminiGenerate(
        `${system}\n\nBuild a marketing strategy for a ${ctx.niche} creator on ${ctx.platform} ` +
        `(goal: ${goalLine}). Return ONLY JSON: { "summary": "...", "pillars": [{"title":"...","why":"...","action":"..."}], "nextSteps": ["..."] }`,
        { temperature: 0.6, maxTokens: 1200 }
      );
      const parsed = parseGeminiJson(raw);
      if (!parsed) return null;
      return {
        niche: ctx.niche,
        platform: ctx.platform,
        goal: goalLine,
        strategy: {
          summary: parsed.summary || '',
          pillars: Array.isArray(parsed.pillars) ? parsed.pillars : [],
          // Empty — Gemini path has no live web; we do NOT fabricate trends.
          currentTrends: [],
          nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
        },
        citations: [],
        trendsNote: 'Live trend data requires Claude web search (ANTHROPIC_API_KEY). Strategy below is from the curated knowledge base.',
      };
    },
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ...result.data, source: result.source };
}

/**
 * getFreshAngles — fresh, partly web-aware content angles for a topic.
 * Returns { topic, niche, angles, source }.
 * Shape preserves the existing /fresh-angles route: angles = [{ headline, why, framework }].
 */
async function getFreshAngles({ userId, niche, platform, topic, language = 'en', tier } = {}) {
  const ctx = await resolveContext({ userId, niche, platform });
  const safeTopic = String(topic || 'content creation').slice(0, 200);
  const { system } = await buildBrainContext({
    userId, niche: ctx.niche, platform: ctx.platform, language, persona: 'creative-director',
  });

  const prompt =
    `Using LIVE web search to spot what's resonating right now, generate 5 fresh content angles for a ` +
    `${ctx.niche} creator on ${ctx.platform} about: "${safeTopic}".\n` +
    `Only reference a current trend if you actually verify it via search — otherwise lean on timeless angles. ` +
    `Do not invent trends.\n\n` +
    `Return ONLY valid JSON:\n{ "angles": [{ "headline": "...", "why": "...", "framework": "..." }] }\n` +
    `5 angles. headline ≤ 90 chars. why = one sentence. framework = a short hook-framework slug.`;

  const result = await runClaudeFirst({
    system, prompt, web: true, maxTokens: 4000, maxWebSearches: 4, tier,
    normalize: (data, citations) => {
      const angles = Array.isArray(data?.angles) ? data.angles : (Array.isArray(data) ? data : null);
      if (!angles) return null;
      return {
        topic: safeTopic,
        niche: ctx.niche,
        platform: ctx.platform,
        angles: angles.slice(0, 5).map(a => ({
          headline: a.headline || a.title || '',
          why: a.why || a.reason || '',
          framework: a.framework || a.hook || '',
        })),
        citations,
      };
    },
    geminiFallback: async () => {
      if (!geminiConfigured) return null;
      const raw = await geminiGenerate(
        `${system}\n\nGenerate 5 content angles for a ${ctx.niche} creator on ${ctx.platform} about "${safeTopic}". ` +
        `Return ONLY JSON: { "angles": [{ "headline": "...", "why": "...", "framework": "..." }] }`,
        { temperature: 0.85, maxTokens: 900 }
      );
      const parsed = parseGeminiJson(raw);
      const angles = Array.isArray(parsed?.angles) ? parsed.angles : null;
      if (!angles) return null;
      return {
        topic: safeTopic,
        niche: ctx.niche,
        platform: ctx.platform,
        angles: angles.slice(0, 5).map(a => ({
          headline: a.headline || a.title || '',
          why: a.why || a.reason || '',
          framework: a.framework || a.hook || '',
        })),
        citations: [],
      };
    },
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ...result.data, source: result.source };
}

/**
 * getEngagementPlan — per-platform engagement prompts tuned to the user's
 * niche + real performance. Non-web (pure reasoning over the knowledge base +
 * the creator's signal), so it uses generateJSON (cheaper, no search).
 * Returns { platform, niche, prompts: { save, comment, share, dm, follow }, source }.
 */
async function getEngagementPlan({ userId, niche, platform, language = 'en', tier } = {}) {
  const ctx = await resolveContext({ userId, niche, platform });
  const { system } = await buildBrainContext({
    userId, niche: ctx.niche, platform: ctx.platform, language, persona: 'marketing-coach',
  });

  const prompt =
    `Write engagement prompts (CTAs) for a ${ctx.niche} creator on ${ctx.platform}, tuned to what works for ` +
    `this niche/platform and biased toward this creator's proven patterns.\n\n` +
    `Return ONLY valid JSON with arrays of short, copy-paste-ready lines:\n` +
    `{ "save": ["...","..."], "comment": ["...","..."], "share": ["...","..."], "dm": ["...","..."], "follow": ["...","..."] }\n` +
    `2-3 lines per category. No emojis unless the niche playbook calls for them.`;

  const result = await runClaudeFirst({
    system, prompt, web: false, maxTokens: 2500, tier,
    normalize: (data) => {
      if (!data || typeof data !== 'object') return null;
      const arr = (k) => (Array.isArray(data[k]) ? data[k].filter(x => typeof x === 'string') : []);
      const prompts = {
        save: arr('save'), comment: arr('comment'), share: arr('share'),
        dm: arr('dm'), follow: arr('follow'),
      };
      // Require at least one non-empty category, else treat as failure.
      if (!Object.values(prompts).some(v => v.length)) return null;
      return { platform: ctx.platform, niche: ctx.niche, prompts };
    },
    geminiFallback: async () => {
      // Deterministic knowledge-base fallback (also covers Gemini being down):
      // pull the niche-tuned CTA library so the route keeps working.
      const { getKnowledgeSlice } = marketingKnowledge;
      const slice = getKnowledgeSlice({ niche: ctx.niche, platform: ctx.platform, language });
      const c = slice.ctas || {};
      const prompts = {
        save: c.save || [], comment: c.comment || [], share: c.share || [],
        dm: c.dm || [], follow: c.follow || [],
      };
      if (!Object.values(prompts).some(v => v.length)) return null;
      return { platform: ctx.platform, niche: ctx.niche, prompts };
    },
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ...result.data, source: result.source };
}

/**
 * askStrategist — the strategist chat. Blends knowledge base + real
 * performance; uses LIVE web search because creators routinely ask "what's
 * trending now / what should I post this week". Non-trend questions still
 * benefit (Claude only searches when useful).
 *
 * Returns { answer, followUps, relatedPlaybooks, niche, platform, source, citations }
 * — identical shape to the existing /strategist/ask route.
 */
async function askStrategist({ userId, question, niche, platform, language = 'en', tier } = {}) {
  const ctx = await resolveContext({ userId, niche, platform });
  const safeQuestion = String(question || '').slice(0, 1500);
  const { system } = await buildBrainContext({
    userId, niche: ctx.niche, platform: ctx.platform, language, persona: 'marketing-coach',
    extra:
      '\nFormatting: be specific — name tools, numbers, exact phrasing. Close with one concrete next step ' +
      'the creator can do TODAY. If you cite a current trend, it MUST come from your web search — never invent one.',
  });

  const prompt =
    `${safeQuestion}\n\n` +
    `Answer the creator. If the question is about what's working / trending now, use LIVE web search and ` +
    `ground claims in real sources. Return ONLY valid JSON:\n` +
    `{ "answer": "...", "followUps": ["q1","q2","q3"], "relatedPlaybooks": ["growth"|"engagement"|"monetization"] }`;

  const result = await runClaudeFirst({
    system, prompt, web: true, maxTokens: 4000, maxWebSearches: 4, tier,
    normalize: (data, citations) => {
      if (!data || typeof data !== 'object' || !data.answer) return null;
      return {
        answer: String(data.answer),
        followUps: Array.isArray(data.followUps) ? data.followUps.slice(0, 4) : [],
        relatedPlaybooks: Array.isArray(data.relatedPlaybooks) ? data.relatedPlaybooks.slice(0, 3) : [],
        niche: ctx.niche,
        platform: ctx.platform,
        citations,
      };
    },
    geminiFallback: async () => {
      if (!geminiConfigured) return null;
      const raw = await geminiGenerate(
        `${system}\n\nCREATOR QUESTION:\n${safeQuestion}\n\nReply with the prose answer first, then a fenced ` +
        '```json block: { "answer": "...", "followUps": ["q1","q2","q3"], "relatedPlaybooks": ["growth"|"engagement"|"monetization"] }',
        { temperature: 0.6, maxTokens: 1200 }
      );
      let answer = (raw || '').trim();
      let followUps = [];
      let relatedPlaybooks = [];
      const parsed = parseGeminiJson(raw);
      if (parsed) {
        if (parsed.answer) answer = parsed.answer;
        else {
          const m = answer.match(/```json[\s\S]+?```/i);
          if (m) answer = answer.replace(m[0], '').trim();
        }
        if (Array.isArray(parsed.followUps)) followUps = parsed.followUps.slice(0, 4);
        if (Array.isArray(parsed.relatedPlaybooks)) relatedPlaybooks = parsed.relatedPlaybooks.slice(0, 3);
      }
      if (!answer) return null;
      return { answer, followUps, relatedPlaybooks, niche: ctx.niche, platform: ctx.platform, citations: [] };
    },
  });

  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, ...result.data, source: result.source };
}

module.exports = {
  resolveContext,
  buildBrainContext,
  getStrategy,
  getFreshAngles,
  getEngagementPlan,
  askStrategist,
  // exported for reuse/testing
  parseGeminiJson,
};
