/**
 * The line-split fallback the list generators (hooks, caption angles, hashtags,
 * carousel slides, first comments) use when the model did not return JSON.
 *
 * Splitting ANY text on newlines turned a prose refusal ("I can't help with
 * that…", "As an AI language model…") or a single paragraph of advice into a
 * one-item "list", which the panel then showed as a generated result. This
 * returns [] for those, so the generator's existing empty check throws
 * aiUnavailable (503) instead.
 */

// Openers of a refusal / apology / non-answer, anchored to the start of the
// text (after an optional quote), where a refusal always is. Deliberately
// narrow: hooks and captions legitimately open with "I can't believe…",
// "Sorry, but your routine is wrong" or "As an AI engineer…", so only the
// phrasings a model uses to decline are matched.
const VERB = '(?:help|assist|provide|create|generate|write|produce|do that|comply|fulfil|fulfill|complete|support)';
const REFUSAL_OPENER = new RegExp(
  '^\\s*["\'“]?\\s*(?:' + [
    "i['’]?m sorry", 'i am sorry', 'i apologi[sz]e', 'my apologies',
    "sorry,? (?:but )?i (?:can(?:not|['’]?t)|am unable|['’]?m unable|won['’]?t)",
    "unfortunately,? i ",
    'as an ai(?: language)? model', 'as an ai assistant', 'as an ai,', 'as a language model',
    "i (?:can(?:not|['’]?t)|am (?:unable|not able)|['’]?m (?:unable|not able)|won['’]?t|will not) " + VERB + '\\b',
    "i (?:do not|don['’]?t) (?:feel comfortable|think i can|have (?:access|the ability))",
    "i['’]?m not comfortable", 'i must decline',
  ].join('|') + ')',
  'i'
);
// Self-references that only appear in a non-answer.
const AI_SELF_REFERENCE = /\bas an ai(?: language)? model\b|\bi(?:['’]m| am) (?:just )?an ai(?: language model| assistant)?\b[,.]/i;

// "Sure! Here are 5 hooks:" — a preamble line, not an item.
const PREAMBLE = /^(?:sure|okay|ok|here|below|certainly|absolutely|of course|great)\b.*:\s*$/i;

function looksLikeRefusal(text) {
  const t = String(text == null ? '' : text).trim();
  if (!t) return false;
  return REFUSAL_OPENER.test(t) || AI_SELF_REFERENCE.test(t);
}

function sentenceCount(line) {
  return (String(line).match(/[.!?](?:\s|$)/g) || []).length;
}

/** A single line that reads as a paragraph of prose rather than one list item. */
function isParagraph(line) {
  const l = String(line || '');
  return l.length > 280 || sentenceCount(l) >= 3;
}

/**
 * Split model text into candidate list items, or [] when it is not a list.
 *
 * @param {string} text            raw model output (already known not to be JSON)
 * @param {object} [opts]
 * @param {RegExp} [opts.separator=/\n/]  how items are separated
 * @param {number} [opts.requested=1]     how many items were asked for
 * @returns {string[]} trimmed, non-empty pieces (callers still strip numbering)
 */
function splitListFallback(text, { separator = /\n/, requested = 1 } = {}) {
  const t = String(text == null ? '' : text).trim();
  if (!t || looksLikeRefusal(t)) return [];
  // Asked for several, got one block of prose (checked before splitting, so a
  // comma separator can't chop a paragraph into "items"): that is an answer
  // ABOUT the task, or a refusal worded some other way — not a list.
  if (requested > 1 && !/\n/.test(t) && isParagraph(t)) return [];

  const lines = t.split(separator)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !PREAMBLE.test(l));

  if (requested > 1 && lines.length === 1 && isParagraph(lines[0])) return [];
  return lines;
}

module.exports = { splitListFallback, looksLikeRefusal, isParagraph };
