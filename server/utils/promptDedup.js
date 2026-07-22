// Cross-call output diversity helpers.
//
// The generative surfaces (hooks, captions, ideas) dedup only WITHIN a single
// response, so clicking "regenerate" — or asking about the same topic again —
// returns overlapping / near-identical results. These helpers let a caller pass
// the items already shown to the user so we can (a) tell the model to avoid them
// and (b) hard-filter any it repeats anyway. Purely additive: an empty/absent
// exclude list is a strict no-op.

const MAX_AVOID = 40; // cap the "avoid" list so it can't blow the prompt budget

/** Extract the comparable text from a string or a shaped item ({text}/{hook}/…). */
function itemText(s) {
  if (s == null) return '';
  if (typeof s === 'string') return s;
  return String(s.text || s.hook || s.caption || s.title || s.idea || s.angle || s.headline || '');
}

/** Normalized dedup key (case/space-insensitive) for matching. */
function dedupKey(s) {
  return itemText(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A prompt fragment instructing the model to avoid the already-shown items.
 * Returns '' when there's nothing to avoid (no-op).
 */
function buildAvoidBlock(exclude, label = 'options') {
  const seen = new Set();
  const lines = [];
  for (const e of (Array.isArray(exclude) ? exclude : [])) {
    const t = itemText(e).trim();
    const k = t.toLowerCase();
    if (t && !seen.has(k)) { seen.add(k); lines.push(t); }
    if (lines.length >= MAX_AVOID) break;
  }
  if (!lines.length) return '';
  return `\n\nAlready shown to the user — do NOT repeat, paraphrase, or lightly reword any of these; produce genuinely DIFFERENT ${label}:\n` +
    lines.map((x, i) => `${i + 1}. ${x}`).join('\n');
}

/** Drop any items whose normalized key matches an excluded item. */
function filterExcluded(items, exclude) {
  const banned = new Set((Array.isArray(exclude) ? exclude : []).map(dedupKey).filter(Boolean));
  if (!banned.size) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter((it) => {
    const k = dedupKey(it);
    return k && !banned.has(k);
  });
}

module.exports = { itemText, dedupKey, buildAvoidBlock, filterExcluded, MAX_AVOID };
