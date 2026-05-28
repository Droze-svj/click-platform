/**
 * Hook ensemble — runs the same hook-generation prompt across Claude, Gemini,
 * and GPT in parallel, scores the candidates, and returns the top-K.
 *
 * Differentiation over single-provider hook gen:
 *   • Diversity: each model has its own bias; ensembling smooths over each
 *     model's blind spots.
 *   • Conditioning: the prompt includes CreatorDNA so the variants drift
 *     toward the user's voice rather than a generic viral template.
 *   • Auto-pipeline: createABTestN registers every variant as a draft, the
 *     scheduler can publish, and the winner can auto-rerender via
 *     /api/video/render so the final clip ships with the proven hook.
 */

const aiRouter = require('../utils/aiRouter');
const logger = require('../utils/logger');
const creatorDnaService = require('./creatorDnaService');
const { getClickPersonalityRules } = require('./marketingKnowledge');

const HOOK_PROMPT = ({ topic, niche, platform, dna, userId }) => `
You are a viral-video hook strategist. Produce 5 distinct video-opening hooks
for this clip. Each hook must be at most 15 words, suitable as the very first
line a creator says or shows on screen.

${getClickPersonalityRules(userId || dna?.userId)}

Topic: ${topic || 'unspecified'}
Niche: ${niche || 'general'}
Platform: ${platform || 'TikTok / Reels / Shorts'}

Creator profile (use to bias style, do not parrot):
- Tone: ${dna?.brandVoice?.tone || 'not yet learned'}
- Top hooks they've used: ${(dna?.weightedTopHooks || dna?.topHooks || []).slice(0, 5).join(', ') || 'none'}
- Pacing: ${dna?.styleFingerprint?.pacingBias || 'unknown'}

Return strictly JSON:
{
  "hooks": [
    { "text": "...", "reason": "why this works", "tags": ["curiosity"|"contrast"|"value"|"pattern-break"|"social-proof"] }
  ]
}
`.trim()

function scoreCandidate(c, dna) {
  // Weighted heuristic score (0..100). Cheap and good-enough until we have
  // real engagement data flowing back through createABTestN winners.
  const text = (c.text || '').trim()
  if (!text) return 0
  const len = text.split(/\s+/).length
  let score = 60
  // Reward concision (5–12 words ideal)
  if (len >= 5 && len <= 12) score += 12
  else if (len > 15) score -= 10
  // Reward sensory / pattern-break openings
  if (/^(stop|wait|nobody|here's|the|why|i|did|how)/i.test(text)) score += 6
  // Reward question / curiosity
  if (/\?$/.test(text)) score += 4
  // Penalize cliché viral fillers
  if (/\b(literally|honestly|actually)\b/i.test(text)) score -= 4
  // DNA conditioning: bonus if it semantically echoes a top historical hook
  const topHooks = (dna?.weightedTopHooks || dna?.topHooks || []).map((h) => String(h).toLowerCase())
  if (topHooks.some((h) => h && text.toLowerCase().includes(h.split(' ').slice(0, 2).join(' ')))) {
    score += 6
  }
  // Tag diversity bonus
  if (Array.isArray(c.tags) && c.tags.length >= 2) score += 3
  return Math.max(0, Math.min(100, score))
}

function dedupe(candidates) {
  const seen = new Set()
  const out = []
  for (const c of candidates) {
    const k = (c.text || '').trim().toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

async function runOnce(prompt, opts) {
  try {
    const r = await aiRouter.aiCallJson(
      prompt,
      { hooks: [] },
      { ...opts, taskType: opts.taskType || 'hook-ensemble', maxTokens: 600, temperature: 0.85 }
    )
    return Array.isArray(r?.hooks) ? r.hooks : []
  } catch (err) {
    logger.warn('[hookEnsemble] one provider failed', {
      provider: opts.preferredProvider,
      error: err.message,
    })
    return []
  }
}

/**
 * Run the ensemble. Returns an array of scored, deduped candidates sorted
 * descending by score, capped at `topK`.
 */
async function generateHooks({ userId, topic, niche, platform, topK = 4 }) {
  const dna = userId ? await creatorDnaService.getCreatorDNA(userId) : null
  const prompt = HOOK_PROMPT({ topic, niche, platform, dna, userId })

  // Fan out — each provider runs independently. Failures are absorbed by
  // runOnce so we never block on a single dead provider.
  const [a, b, c] = await Promise.all([
    runOnce(prompt, { preferredProvider: 'anthropic' }),
    runOnce(prompt, { preferredProvider: 'openai' }),
    runOnce(prompt, { preferredProvider: 'gemini' }),
  ])

  const all = [...a, ...b, ...c]
  const cleaned = dedupe(all).map((h) => ({
    text: String(h.text || '').trim(),
    reason: String(h.reason || '').trim(),
    tags: Array.isArray(h.tags) ? h.tags : [],
  }))
  cleaned.forEach((h) => {
    h.score = scoreCandidate(h, dna)
  })
  cleaned.sort((x, y) => (y.score || 0) - (x.score || 0))

  return {
    candidates: cleaned.slice(0, Math.max(2, topK)),
    totalGenerated: all.length,
    dnaConfidence: dna?.confidence || 'low',
  }
}

/**
 * End-to-end pipeline:
 *   1. Generate ensemble hooks.
 *   2. Register top-K as variants in an N-arm A/B test (drafts).
 *   3. Return the test + variants so the caller can publish/test.
 *
 * The auto-rerender of the winner (post-test) is left to a downstream
 * scheduler that calls `/api/video/render` after `getABTestResults` declares
 * a winner — no need to bake that into this synchronous endpoint.
 */
async function generateHooksAndRegisterTest({ userId, topic, niche, platform, topK = 4, projectId }) {
  const ab = require('./abTestingService')
  const ensemble = await generateHooks({ userId, topic, niche, platform, topK })
  const variants = ensemble.candidates.map((c, i) => ({
    title: c.text,
    body: c.reason || '',
    text: c.text,
    score: c.score,
    tags: c.tags,
    arm: String.fromCharCode(65 + i),
  }))
  let test = null
  try {
    test = await ab.createABTestN(userId, {
      name: `Hook ensemble ${projectId || ''}`.trim(),
      variants,
      platform,
    })
  } catch (err) {
    logger.warn('[hookEnsemble] createABTestN failed', { error: err.message })
  }
  return { ...ensemble, test }
}

module.exports = {
  generateHooks,
  generateHooksAndRegisterTest,
  scoreCandidate,
  HOOK_PROMPT,
}
