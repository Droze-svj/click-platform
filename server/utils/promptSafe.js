// Safety wrapper for USER-SUPPLIED text that gets interpolated into an LLM prompt.
//
// Two real problems this solves:
//  1. TRUNCATION - gemini-2.5-flash spends its token budget on the input first, so a
//     long transcript/caption-context silently eats the budget and the model's REAL
//     output comes back cut off mid-sentence (or mid-JSON). Capping the input length
//     leaves room for the output. (This is the #1 "AI output looks wrong" cause.)
//  2. COST/abuse - an unbounded user field can balloon a paid call.
//
// It also strips control characters and (conservatively) defuses the most blatant
// prompt-injection lead-ins WITHOUT mangling normal content - we only touch exact
// "ignore/disregard previous/above instructions" override phrases, which essentially
// never appear in genuine video transcripts or captions.

// ~6000 chars is about ~1500 tokens of context - generous, and leaves the rest of
// the budget for the model's response.
const DEFAULT_MAX_CHARS = 6000;

// Strip control chars EXCEPT tab (\x09), newline (\x0a), carriage return (\x0d).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f]/g;
const INJECTION_OVERRIDE = /\b(ignore|disregard|forget)\s+(?:(?:all|the|your|any|prior)\s+)*(previous|above|prior|earlier|system)\s+(instructions?|prompts?|messages?|rules?)/gi;

function capForPrompt(input, maxChars = DEFAULT_MAX_CHARS) {
  let s = String(input == null ? '' : input).replace(CONTROL_CHARS, '');
  s = s.replace(INJECTION_OVERRIDE, '[redacted]');
  if (s.length > maxChars) {
    s = s.slice(0, maxChars) + ' ...[truncated for length]';
  }
  return s;
}

module.exports = { capForPrompt, DEFAULT_MAX_CHARS };
