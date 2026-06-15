// Escape user-supplied text before it is used as a MongoDB $regex / RegExp source.
// User search strings flow into { $regex } / new RegExp() in several places; an
// unescaped catastrophic-backtracking pattern (e.g. "(a+)+$") would pin a DB/CPU
// worker (ReDoS). This neutralizes every regex metacharacter and caps the length
// so the resulting pattern is a plain literal substring match.
function escapeRegex(input, maxLen = 128) {
  if (input == null) return '';
  return String(input).slice(0, maxLen).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegex };
