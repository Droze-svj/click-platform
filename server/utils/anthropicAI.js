// Anthropic Claude client wrapper for high-reasoning JSON generation.
//
// Mirrors the shape of utils/googleAI.js (lazy-init, single export surface)
// but targets Claude Opus 4.8 with adaptive thinking + high effort for the
// AI Director. Unlike googleAI, this NEVER returns mock/fabricated data — if
// the key is missing or the call fails, callers get an honest error so they
// can show a real message rather than a fake plan (owner's #1 rule).
//
// Authoritative SDK usage (see CLAUDE.md / claude-api skill):
//   - Model: 'claude-opus-4-8' (exact string).
//   - thinking: { type: 'adaptive' }, output_config: { effort: 'high' }.
//   - NO temperature / top_p / top_k / budget_tokens (HTTP 400 on Opus 4.8).
//   - STREAM (plan output is large) and read the final message.

const logger = require('./logger');
const { aiProfileForTier, DEFAULT_PROFILE } = require('../config/aiProfiles');

let Anthropic = null;
let client = null;

try {
  // Default export is the Anthropic class (CommonJS).
  Anthropic = require('@anthropic-ai/sdk');
} catch (_) {
  // Package not installed in this environment.
}

/**
 * Lazily construct the client. Returns null when the SDK isn't installed or
 * no API key is configured.
 */
function getClient() {
  if (client) return client;
  if (!Anthropic) return null;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    // M1: explicit request timeout + a single retry so a stuck call can't hang
    // for the SDK default (~10 min) × default retries. 90s per attempt, 1 retry.
    client = new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 });
    logger.info(`🛰️ [AnthropicAI] Claude client initialized (Key: ${apiKey.substring(0, 6)}...${apiKey.slice(-4)})`);
  } catch (err) {
    logger.error('[AnthropicAI] Client init failed', { error: err?.message });
    return null;
  }
  return client;
}

/** Whether the AI Director can run (SDK present + key configured). */
function isConfigured() {
  return !!(Anthropic && process.env.ANTHROPIC_API_KEY);
}

/**
 * Pull the concatenated text from a Claude message's content blocks. Thinking
 * blocks are ignored — we only want the model's visible answer.
 */
function extractText(msg) {
  if (!msg || !Array.isArray(msg.content)) return '';
  return msg.content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * Robustly parse JSON from a model response: strip markdown fences, then carve
 * out the first `{` … last `}` (or `[` … `]`) span and parse that. Returns the
 * parsed value or null on failure (no throwing — caller decides what to do).
 */
function robustParseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();

  // Strip ```json ... ``` / ``` ... ``` fences.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) s = fence[1].trim();

  // Direct parse first.
  try {
    return JSON.parse(s);
  } catch (_) { /* fall through to span extraction */ }

  // Carve the outermost JSON span. Objects are the expected shape; fall back
  // to arrays if the response is bare-array shaped.
  const firstObj = s.indexOf('{');
  const lastObj = s.lastIndexOf('}');
  const firstArr = s.indexOf('[');
  const lastArr = s.lastIndexOf(']');

  const candidates = [];
  if (firstObj !== -1 && lastObj > firstObj) candidates.push(s.slice(firstObj, lastObj + 1));
  if (firstArr !== -1 && lastArr > firstArr) candidates.push(s.slice(firstArr, lastArr + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) { /* try next */ }
  }
  return null;
}

/**
 * One streaming Claude call. Returns the final message object (with
 * .content blocks) or throws on transport/API error.
 *
 * `tools` (optional) — when provided (e.g. the server-side web_search tool),
 * they're forwarded verbatim and the SDK runs Anthropic's server-side tool
 * loop for us; `.finalMessage()` still resolves to the completed message with
 * all content blocks (text + citations) once the loop settles.
 */
async function streamMessage({ system, messages, model, maxTokens, timeout, tools, effort }) {
  const c = getClient();
  if (!c) throw new Error('Anthropic client unavailable');

  // M1: allow a per-call timeout override so the parse-retry shares the budget
  // (it gets a tighter ceiling) rather than getting a fresh full 90s allowance.
  // Web-search calls can run several server-side round-trips, so callers pass a
  // larger timeout for those.
  const caller = (typeof timeout === 'number' && typeof c.withOptions === 'function')
    ? c.withOptions({ timeout })
    : c;

  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    thinking: { type: 'adaptive' },
    // Effort scales with the caller's AI profile (tier). Defaults to 'high' —
    // identical to the pre-profiles behavior — when no profile is threaded in.
    output_config: { effort: effort || 'high' },
  };
  if (Array.isArray(tools) && tools.length > 0) params.tools = tools;

  const stream = caller.messages.stream(params);
  return stream.finalMessage();
}

/**
 * Resolve the per-call AI knobs from opts. Precedence (highest first):
 *   1. an explicit `opts.<field>` (model/maxTokens/maxWebSearches/effort)
 *   2. an explicit `opts.profile` object
 *   3. `opts.tier` → aiProfileForTier(tier)
 *   4. DEFAULT_PROFILE (== the pre-profiles default behavior)
 *
 * Callers that pass none of these get byte-identical behavior to before
 * profiles existed, so this is a safe, additive change for every existing site.
 */
function resolveCallParams(opts = {}) {
  const profile = opts.profile
    || (opts.tier != null ? aiProfileForTier(opts.tier) : null)
    || DEFAULT_PROFILE;

  return {
    model: opts.model || profile.model || DEFAULT_PROFILE.model,
    maxTokens: typeof opts.maxTokens === 'number' ? opts.maxTokens : profile.maxTokens,
    effort: opts.effort || profile.effort || DEFAULT_PROFILE.effort,
    maxWebSearches: typeof opts.maxWebSearches === 'number' ? opts.maxWebSearches : profile.maxWebSearches,
  };
}

/**
 * Pull citation source URLs from a Claude message's content blocks.
 *
 * When the server-side web_search tool runs, Claude attaches `citations` to
 * the text blocks it grounds in search results. Each citation can carry a
 * `url` (+ `title`). We also surface the raw queries Claude issued via the
 * `server_tool_use` / `web_search_tool_result` blocks so the UI can show
 * "searched for X" provenance. Returns a de-duplicated array of
 * `{ url, title }` (sources) — never throws.
 */
function extractCitations(msg) {
  if (!msg || !Array.isArray(msg.content)) return [];
  const seen = new Set();
  const sources = [];

  const pushSource = (url, title) => {
    if (!url || typeof url !== 'string') return;
    if (seen.has(url)) return;
    seen.add(url);
    sources.push({ url, title: title || null });
  };

  for (const block of msg.content) {
    if (!block || typeof block !== 'object') continue;

    // 1) Inline citations attached to text blocks (the authoritative source).
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const cit of block.citations) {
        if (cit && typeof cit === 'object') pushSource(cit.url, cit.title);
      }
    }

    // 2) web_search_tool_result blocks carry the raw result list. These back
    //    the citations above; include any URLs Claude surfaced even if it
    //    didn't inline-cite every one.
    if (block.type === 'web_search_tool_result') {
      const content = block.content;
      const results = Array.isArray(content) ? content : (content?.content || []);
      if (Array.isArray(results)) {
        for (const r of results) {
          if (r && typeof r === 'object') pushSource(r.url, r.title);
        }
      }
    }
  }

  return sources;
}

/**
 * generateJSON — run a prompt through Claude and return parsed JSON.
 *
 * @param {string} prompt - the user prompt (JSON instructions included).
 * @param {Object} [opts]
 * @param {string} [opts.system] - system prompt.
 * @param {string} [opts.model='claude-opus-4-8']
 * @param {number} [opts.maxTokens=16000]
 * @param {string} [opts.tier] - caller's tier; scales effort/maxTokens via aiProfiles.
 * @param {object} [opts.profile] - explicit AI profile (overrides tier).
 * @param {string} [opts.effort] - explicit effort override.
 * @returns {Promise<{ok:true,data:any}|{ok:false,error:string}>}
 *
 * Streams, extracts text, robust-parses. On parse failure, retries ONCE with a
 * "return ONLY valid JSON" nudge. On a second failure, returns an honest error
 * — never fabricates output.
 */
async function generateJSON(prompt, opts = {}) {
  const { system } = opts;
  const { model, maxTokens, effort } = resolveCallParams(opts);

  if (!isConfigured()) {
    return { ok: false, error: 'AI Director needs Claude configured (ANTHROPIC_API_KEY).' };
  }

  const baseMessages = [{ role: 'user', content: prompt }];

  try {
    // First attempt.
    const msg = await streamMessage({ system, messages: baseMessages, model, maxTokens, effort });
    const text = extractText(msg);
    const parsed = robustParseJSON(text);
    if (parsed) return { ok: true, data: parsed };

    logger.warn('[AnthropicAI] First JSON parse failed — retrying with strict nudge', {
      preview: String(text || '').slice(0, 160),
    });

    // Retry once: feed back the prior (assistant) output and demand pure JSON.
    const retryMessages = [
      ...baseMessages,
      { role: 'assistant', content: text || '' },
      {
        role: 'user',
        content:
          'Your previous response could not be parsed as JSON. Reply again with ONLY ' +
          'valid JSON — no prose, no markdown fences, no commentary. Same schema as requested.',
      },
    ];
    // Share the budget: the parse-retry gets a tighter ceiling (45s) so one
    // request can't consume ~3 minutes across two full-budget attempts.
    const retryMsg = await streamMessage({ system, messages: retryMessages, model, maxTokens, effort, timeout: 45_000 });
    const retryText = extractText(retryMsg);
    const retryParsed = robustParseJSON(retryText);
    if (retryParsed) return { ok: true, data: retryParsed };

    logger.error('[AnthropicAI] JSON parse failed after retry', {
      preview: String(retryText || '').slice(0, 160),
    });
    return { ok: false, error: 'Claude returned a response we could not parse as a plan. Please try again.' };
  } catch (err) {
    // Map Anthropic errors using status/message.
    const status = err?.status;
    const rawMsg = err?.message || String(err);
    logger.error('[AnthropicAI] generateJSON failed', { status, error: rawMsg.slice(0, 240) });

    let friendly;
    if (status === 401 || status === 403) {
      friendly = 'AI Director could not authenticate with Claude (check ANTHROPIC_API_KEY).';
    } else if (status === 429) {
      friendly = 'AI Director is rate-limited right now — please try again in a moment.';
    } else if (typeof status === 'number' && status >= 500) {
      friendly = 'Claude is temporarily unavailable — please try again shortly.';
    } else {
      friendly = `AI Director request failed: ${rawMsg.slice(0, 160)}`;
    }
    return { ok: false, error: friendly };
  }
}

/**
 * generateJSONWithWeb — run a prompt through Claude with the server-side
 * web_search tool enabled, returning robust-parsed JSON + the sources Claude
 * cited. Use this for trend/strategy calls that must reflect what's happening
 * RIGHT NOW — Claude searches the live web on Anthropic's infra, grounds its
 * answer, and we extract the source URLs so nothing is presented as "live"
 * without provenance (owner's #1 rule).
 *
 * @param {string} prompt
 * @param {Object} [opts]
 * @param {string} [opts.system]
 * @param {string} [opts.model='claude-opus-4-8']
 * @param {number} [opts.maxTokens=16000]
 * @param {number} [opts.maxWebSearches=4] - cap server-side searches (cost/latency).
 * @param {string} [opts.tier] - caller's tier; scales effort/maxTokens/maxWebSearches via aiProfiles.
 * @param {object} [opts.profile] - explicit AI profile (overrides tier).
 * @returns {Promise<{ok:true,data:any,citations:Array<{url,title}>}|{ok:false,error:string}>}
 *
 * Web search runs several server-side round-trips, so the per-call timeout is
 * larger than the plain JSON path. On parse failure it does NOT re-search
 * (that would re-bill searches) — it returns an honest error. Never fabricates.
 */
async function generateJSONWithWeb(prompt, opts = {}) {
  const { system } = opts;
  const { model, maxTokens, effort, maxWebSearches } = resolveCallParams(opts);

  if (!isConfigured()) {
    return { ok: false, error: 'AI brain needs Claude configured (ANTHROPIC_API_KEY).' };
  }

  // Honor a resolved maxWebSearches of 0 (e.g. the free profile's "no live web"
  // setting): do NOT attach the web tool or bill a search — fall through to the
  // plain non-web JSON path so the call stays accurate but ungrounded. Previously
  // Math.max(1, ...) silently forced ≥1 search, leaking paid live web to free.
  const webBudget = Number.isFinite(maxWebSearches) ? maxWebSearches : 4;
  if (webBudget <= 0) {
    const res = await generateJSON(prompt, { ...opts, maxWebSearches: undefined });
    return res.ok ? { ...res, citations: [] } : res;
  }

  // Server-side web search tool (see claude-api skill — web_search_20260209
  // adds dynamic filtering on Opus 4.8). max_uses caps cost/latency.
  const tools = [{
    type: 'web_search_20260209',
    name: 'web_search',
    max_uses: Math.max(1, Math.min(webBudget, 8)),
  }];

  try {
    // 180s — web search can chain multiple server-side searches + fetches.
    const msg = await streamMessage({
      system,
      messages: [{ role: 'user', content: prompt }],
      model,
      maxTokens,
      effort,
      timeout: 180_000,
      tools,
    });

    const text = extractText(msg);
    const citations = extractCitations(msg);
    const parsed = robustParseJSON(text);

    if (parsed) return { ok: true, data: parsed, citations };

    logger.error('[AnthropicAI] generateJSONWithWeb: unparseable response', {
      preview: String(text || '').slice(0, 160),
    });
    return { ok: false, error: 'Claude returned a web-grounded answer we could not parse. Please try again.' };
  } catch (err) {
    const status = err?.status;
    const rawMsg = err?.message || String(err);
    logger.error('[AnthropicAI] generateJSONWithWeb failed', { status, error: rawMsg.slice(0, 240) });

    let friendly;
    if (status === 401 || status === 403) {
      friendly = 'AI brain could not authenticate with Claude (check ANTHROPIC_API_KEY).';
    } else if (status === 429) {
      friendly = 'AI brain is rate-limited right now — please try again in a moment.';
    } else if (typeof status === 'number' && status >= 500) {
      friendly = 'Claude is temporarily unavailable — please try again shortly.';
    } else {
      friendly = `AI brain web request failed: ${rawMsg.slice(0, 160)}`;
    }
    return { ok: false, error: friendly };
  }
}

module.exports = {
  isConfigured,
  generateJSON,
  generateJSONWithWeb,
  // Exported for unit testing / reuse.
  robustParseJSON,
  extractText,
  extractCitations,
};
