// AI input-size cap (closes audit item M1).
//
// The global express.json() limit is 10mb — that's ~2.5M tokens, far larger than any
// reasonable LLM input. Without a tighter cap, a single oversized `transcript`/
// `content`/`prompt` field can burn a large slice of a user's AI budget in one call.
// This caps the free-text fields fed into a model at the TOKEN level (≈ chars/4),
// returning an actionable 413 instead of silently spending. Reuses aiRouter's
// assertPromptSize. Best-effort: the guard itself never breaks a request.

const { assertPromptSize } = require('../utils/aiRouter');

// Body fields that carry free text fed into an LLM across the AI surfaces.
// `topic` is the primary free-text input on the ideation/intelligence surfaces.
const TEXT_FIELDS = ['transcript', 'content', 'prompt', 'text', 'script', 'copy', 'input', 'message', 'caption', 'topic'];
// ~60k tokens ≈ 240KB of text — generous for real prompts, far below the 10mb body cap.
const CEILING = parseInt(process.env.AI_INPUT_TOKEN_CEILING || '60000', 10);

function aiInputCap(req, res, next) {
  try {
    const body = req.body;
    if (body && typeof body === 'object') {
      for (const f of TEXT_FIELDS) {
        const v = body[f];
        if (typeof v === 'string' && v.length > 0) {
          const { exceeded, tokens, ceiling } = assertPromptSize(v, { ceiling: CEILING, label: f });
          if (exceeded) {
            return res.status(413).json({
              success: false,
              code: 'AI_INPUT_TOO_LARGE',
              error: `Input "${f}" is too large (~${tokens} tokens; max ${ceiling}). Please shorten it and try again.`,
            });
          }
        }
      }
    }
  } catch (_) {
    // The cap must never itself break a request.
  }
  return next();
}

module.exports = aiInputCap;
