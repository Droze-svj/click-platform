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
 */
async function streamMessage({ system, messages, model, maxTokens, timeout }) {
  const c = getClient();
  if (!c) throw new Error('Anthropic client unavailable');

  // M1: allow a per-call timeout override so the parse-retry shares the budget
  // (it gets a tighter ceiling) rather than getting a fresh full 90s allowance.
  const caller = (typeof timeout === 'number' && typeof c.withOptions === 'function')
    ? c.withOptions({ timeout })
    : c;

  const stream = caller.messages.stream({
    model,
    max_tokens: maxTokens,
    system,
    messages,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
  });
  return stream.finalMessage();
}

/**
 * generateJSON — run a prompt through Claude and return parsed JSON.
 *
 * @param {string} prompt - the user prompt (JSON instructions included).
 * @param {Object} [opts]
 * @param {string} [opts.system] - system prompt.
 * @param {string} [opts.model='claude-opus-4-8']
 * @param {number} [opts.maxTokens=16000]
 * @returns {Promise<{ok:true,data:any}|{ok:false,error:string}>}
 *
 * Streams, extracts text, robust-parses. On parse failure, retries ONCE with a
 * "return ONLY valid JSON" nudge. On a second failure, returns an honest error
 * — never fabricates output.
 */
async function generateJSON(prompt, opts = {}) {
  const { system, model = 'claude-opus-4-8', maxTokens = 16000 } = opts;

  if (!isConfigured()) {
    return { ok: false, error: 'AI Director needs Claude configured (ANTHROPIC_API_KEY).' };
  }

  const baseMessages = [{ role: 'user', content: prompt }];

  try {
    // First attempt.
    const msg = await streamMessage({ system, messages: baseMessages, model, maxTokens });
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
    const retryMsg = await streamMessage({ system, messages: retryMessages, model, maxTokens, timeout: 45_000 });
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

module.exports = {
  isConfigured,
  generateJSON,
  // Exported for unit testing / reuse.
  robustParseJSON,
  extractText,
};
