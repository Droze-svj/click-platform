/**
 * aiRouter — single entry point for LLM calls across the codebase.
 *
 * Why this exists:
 *   - The Gemini free tier hits its daily quota fast. When it does, every
 *     AI feature in Click 500s or empty-states. The router lets services
 *     keep working by falling through Gemini → OpenAI → Anthropic →
 *     deterministic fallback.
 *   - Three providers have three different "JSON modes" (Gemini sometimes
 *     prepends ```json fences, OpenAI's response_format is strict,
 *     Anthropic uses tool-use). We standardise by NEVER trusting any
 *     provider's JSON mode and always running responses through
 *     safeJsonParse() with the caller's fallback.
 *
 * Public surface:
 *   - aiCall(prompt, opts) → { text, provider, latencyMs, error? }
 *   - aiCallJson(prompt, fallback, opts) → parsed object (best-effort)
 *   - safeJsonParse(text, fallback) — also exported so heuristic fallback
 *     paths can use the same defensive parser.
 *   - isProviderAvailable(name) — lets callers tailor prompts per provider.
 */

const logger = require('./logger');

// Gemini — already wrapped in our own utility with dev fallback + Sentry.
const googleAI = require('./googleAI');

// OpenAI client. Loaded lazily so an absent OPENAI_API_KEY costs nothing.
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (err) {
  logger.warn('aiRouter: openai package not loadable', { error: err.message });
}

// Anthropic SDK is optional — add to deps when ANTHROPIC_API_KEY is wired.
// Lazy-require keeps boot clean if the package isn't installed yet.
let anthropic = null;
try {
  if (process.env.ANTHROPIC_API_KEY) {
    const Anthropic = require('@anthropic-ai/sdk');
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
} catch (err) {
  logger.warn('aiRouter: @anthropic-ai/sdk not installed — set ANTHROPIC_API_KEY and add the dep to enable', { error: err.message });
}

const KILL_FALLBACK = process.env.AI_ROUTER_DISABLE_FALLBACK === 'true';

// Default fallback order — used when no taskKind is specified. Gemini first
// because it's the cheapest + lowest-latency tier and we use it for the
// long tail of "write me a caption" calls.
const PROVIDER_ORDER = ['gemini', 'openai', 'anthropic'];

/**
 * Task-aware provider chains. Each list is the *preference* order; if the
 * top choice isn't configured (or fails / hits quota) we fall through to
 * the next. This is how we get "Claude for orchestration, GPT-4o for
 * vision, Gemini for speed" without forcing the caller to hard-code a
 * provider.
 *
 * - `orchestration`: chain-of-thought, multi-step planning, agent loops.
 *   Claude's reasoning + long context win here; falls back to GPT-4o.
 * - `vision`: image / video frame analysis, thumbnail picking, OCR.
 *   GPT-4o native vision wins; fallback to Gemini Vision.
 * - `fast`: single-shot text generation where latency matters more than
 *   reasoning depth (captions, hashtags, hooks). Gemini is the cheapest
 *   + fastest tier; we lean on it.
 * - `creative`: prose generation where voice / style matter. Claude tends
 *   to produce less generic copy than GPT-4o.
 */
const TASK_PROVIDER_CHAIN = {
  orchestration: ['anthropic', 'openai', 'gemini'],
  vision:        ['openai', 'gemini', 'anthropic'],
  fast:          ['gemini', 'openai', 'anthropic'],
  creative:      ['anthropic', 'gemini', 'openai'],
  json:          ['gemini', 'openai', 'anthropic'], // JSON-mode tasks
  default:       PROVIDER_ORDER,
};

/**
 * 2026 model lineup — refresh this when newer SKUs ship. Each provider's
 * "default" is what we use for the corresponding task kind unless the
 * caller passes an explicit `openaiModel` / `anthropicModel` override.
 */
const MODEL_DEFAULTS = {
  // Anthropic: claude-opus-4-7 is the latest Opus generation (per the
  // project knowledge cutoff). The mini-Sonnet variant is a cheaper
  // fall-through for high-volume orchestration.
  anthropic: {
    orchestration: 'claude-opus-4-7',
    creative:      'claude-opus-4-7',
    fast:          'claude-haiku-4-5-20251001',
    default:       'claude-sonnet-4-6',
  },
  // OpenAI: gpt-4o has native vision; gpt-4o-mini is the latency-tier
  // workhorse we already used elsewhere in the codebase.
  openai: {
    vision:        'gpt-4o',
    orchestration: 'gpt-4o',
    fast:          'gpt-4o-mini',
    creative:      'gpt-4o',
    default:       'gpt-4o-mini',
  },
  // Gemini handled inside googleAI util; we just pass `maxTokens`. The
  // wrapper uses 'gemini-flash-latest' which auto-resolves to the most
  // recent flash SKU. No per-task override needed today.
};

// Per-provider retry policy — Gemini's 429 is daily, but its 503 is transient.
// OpenAI's is per-minute, a single short retry can clear; Anthropic
// publishes Retry-After but a flat 4s is close enough for our purposes.
const PROVIDER_RETRY_MS = { gemini: 2000, openai: 4000, anthropic: 4000 };

function isQuotaOrRateLimit(err) {
  const msg = String(err?.message || err || '');
  const status = err?.status || err?.statusCode;
  if (status === 429 || status === 503 || status === 504) return true;
  return /\b(429|503|504|quota|rate.?limit|RESOURCE_EXHAUSTED|exceeded|unavailable|overloaded)\b/i.test(msg);
}

function isAuthError(err) {
  const status = err?.status || err?.statusCode;
  if (status === 401 || status === 403) return true;
  return /\b(401|403|invalid_api_key|unauthorized|permission denied)\b/i.test(String(err?.message || ''));
}

/**
 * Defensive JSON parse that survives Gemini's occasional ```json fences,
 * trailing commas in OpenAI tool-use, and Anthropic's "Here is the JSON:"
 * preamble. Returns `fallback` on any error.
 */
function safeJsonParse(text, fallback = null) {
  if (text == null) return fallback;
  if (typeof text !== 'string') return text;
  let s = text.trim();
  // Strip ```json fences if present.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // Sometimes the model emits "Here is the JSON:\n{...}".
  const firstBrace = s.indexOf('{');
  const firstBracket = s.indexOf('[');
  const start = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  if (start > 0) s = s.slice(start);
  try { return JSON.parse(s); } catch {
    // Try to repair trailing commas (a common GPT-4 quirk in array tail).
    try { return JSON.parse(s.replace(/,(\s*[}\]])/g, '$1')); } catch {
      return fallback;
    }
  }
}

async function callGemini(prompt, opts) {
  if (!googleAI.isConfigured) throw new Error('gemini-not-configured');
  const text = await googleAI.generateContent(prompt, {
    maxTokens: Math.max(4096, opts.maxTokens || 0),
    temperature: opts.temperature ?? 0.7,
  });
  if (text == null || text === '') throw new Error('gemini-empty-response');
  return text;
}

async function callOpenAI(prompt, opts) {
  if (!openai) throw new Error('openai-not-configured');
  const messages = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const taskKind = opts.taskKind || 'default';
  const model = opts.openaiModel || MODEL_DEFAULTS.openai[taskKind] || MODEL_DEFAULTS.openai.default;
  const completion = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
    ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  const text = completion?.choices?.[0]?.message?.content;
  if (!text) throw new Error('openai-empty-response');
  return text;
}

async function callAnthropic(prompt, opts) {
  if (!anthropic) throw new Error('anthropic-not-configured');
  const taskKind = opts.taskKind || 'default';
  const model = opts.anthropicModel || MODEL_DEFAULTS.anthropic[taskKind] || MODEL_DEFAULTS.anthropic.default;
  const msg = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens || 1024,
    temperature: opts.temperature ?? 0.7,
    system: opts.systemPrompt || undefined,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg?.content?.[0]?.text;
  if (!text) throw new Error('anthropic-empty-response');
  return text;
}

const PROVIDER_FNS = { gemini: callGemini, openai: callOpenAI, anthropic: callAnthropic };

function isProviderAvailable(name) {
  if (name === 'gemini') return !!googleAI.isConfigured;
  if (name === 'openai') return !!openai;
  if (name === 'anthropic') return !!anthropic;
  return false;
}

function sleep(ms) { return new Promise((res) => setTimeout(res, ms)); }

/**
 * Main router entry. Walks the provider chain, returning the first
 * successful response. On total failure (all providers down), returns
 * { text: '', provider: 'none', error } unless KILL_FALLBACK is set,
 * in which case re-throws.
 *
 * @param {string} prompt
 * @param {object} opts
 *   - systemPrompt {string}     prepended for OpenAI/Anthropic; baked into
 *                               the prompt for Gemini (which doesn't have a
 *                               separate system role at this SDK layer)
 *   - jsonMode     {boolean}    set OpenAI response_format etc. NOT trusted
 *                               — caller still parses through safeJsonParse
 *   - maxTokens    {number}     default 1024
 *   - temperature  {number}     default 0.7
 *   - taskType     {string}     telemetry tag (e.g. 'hook-analysis')
 *   - openaiModel  {string}     override (default gpt-4o-mini)
 *   - anthropicModel {string}   override (default claude-3-haiku-20240307)
 *   - preferredProvider {string} skip earlier providers in the chain
 */
async function aiCall(prompt, opts = {}) {
  const startedAt = Date.now();
  // Task-kind picks the right provider chain (Claude-first for
  // orchestration, OpenAI-first for vision, Gemini-first for fast text).
  // Explicit preferredProvider always wins.
  const baseChain = opts.taskKind && TASK_PROVIDER_CHAIN[opts.taskKind]
    ? TASK_PROVIDER_CHAIN[opts.taskKind]
    : PROVIDER_ORDER;
  const order = opts.preferredProvider
    ? [opts.preferredProvider, ...baseChain.filter(p => p !== opts.preferredProvider)]
    : baseChain;

  // Bake the system prompt into the user prompt for Gemini (no system role
  // in our googleAI wrapper layer). Other providers receive it natively.
  const geminiPrompt = opts.systemPrompt
    ? `${opts.systemPrompt}\n\n── Task ──\n${prompt}`
    : prompt;

  const errors = [];
  for (const provider of order) {
    if (!isProviderAvailable(provider)) continue;
    const fn = PROVIDER_FNS[provider];
    const promptForProvider = provider === 'gemini' ? geminiPrompt : prompt;
    try {
      const text = await fn(promptForProvider, opts);
      const latencyMs = Date.now() - startedAt;
      logger.info('aiRouter: success', {
        provider,
        taskType: opts.taskType || 'unknown',
        latencyMs,
        promptChars: prompt.length,
        responseChars: text.length,
      });
      return { text, provider, latencyMs };
    } catch (err) {
      errors.push({ provider, msg: err?.message || String(err) });
      const isAuth = isAuthError(err);
      const isQuota = isQuotaOrRateLimit(err);
      logger.warn('aiRouter: provider failed, trying next', {
        provider,
        taskType: opts.taskType || 'unknown',
        isAuth,
        isQuota,
        error: (err?.message || '').slice(0, 200),
      });
      // OpenAI rate-limits clear quickly — one short retry inside the same
      // provider before falling through.
      if (isQuota && PROVIDER_RETRY_MS[provider] > 0) {
        await sleep(PROVIDER_RETRY_MS[provider]);
        try {
          const text = await fn(promptForProvider, opts);
          const latencyMs = Date.now() - startedAt;
          logger.info('aiRouter: success on retry', { provider, latencyMs });
          return { text, provider, latencyMs };
        } catch (err2) {
          errors.push({ provider: `${provider}-retry`, msg: err2?.message || String(err2) });
        }
      }
    }
  }

  const latencyMs = Date.now() - startedAt;
  logger.error('aiRouter: all providers failed', { errors, taskType: opts.taskType || 'unknown', latencyMs });
  if (KILL_FALLBACK) {
    const e = new Error('aiRouter: all providers failed');
    e.cause = errors;
    throw e;
  }
  return { text: '', provider: 'none', latencyMs, error: 'all-providers-failed', attempts: errors };
}

/**
 * Convenience: aiCall + safeJsonParse in one shot. Always returns the
 * fallback if any step fails, never throws (unless KILL_FALLBACK is set).
 */
async function aiCallJson(prompt, fallback = null, opts = {}) {
  const r = await aiCall(prompt, { ...opts, jsonMode: true });
  if (!r.text) return fallback;
  return safeJsonParse(r.text, fallback);
}

module.exports = {
  aiCall,
  aiCallJson,
  safeJsonParse,
  isProviderAvailable,
  // Useful for tests + telemetry.
  PROVIDER_ORDER,
  TASK_PROVIDER_CHAIN,
  MODEL_DEFAULTS,
};
