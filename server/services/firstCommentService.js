// First-Comment Generator
// Drafts the strategic pinned "first comment" for a post — the one creators pin
// to spark early comment velocity (which most feeds reward), push a CTA, or point
// to a link without dropping a bare URL in the caption. Returns a few options to
// choose from. Pure prompt/parse core + injectable AI so it is unit-testable.

// Supported goals + the guidance injected into the prompt.
const GOALS = {
  engagement: 'Ask ONE specific, easy-to-answer question that sparks replies (early comment velocity boosts reach). Invite opinions or a quick pick.',
  cta: 'A clear, natural call-to-action (save this, share with a friend, follow for part 2). One action, no hard sell.',
  link: 'Point people to the link naturally (e.g. "full guide is linked in my bio") — do NOT paste a raw URL, and do not over-promise.',
};
const DEFAULT_GOAL = 'engagement';

function normalizeGoal(goal) {
  return GOALS[goal] ? goal : DEFAULT_GOAL;
}

/**
 * Pure: build the generation prompt for 3 first-comment options.
 */
function buildPrompt({ platform, goal, sourceText }) {
  const g = normalizeGoal(goal);
  return `You write the pinned FIRST COMMENT a creator posts under their own ${platform} post.
Goal: ${GOALS[g]}

Post content:
"""
${sourceText}
"""
Rules:
- Return exactly 3 distinct options, each 1-2 short sentences.
- Sound like a real creator, not a marketer. No hashtags. No "as an AI".
- Do NOT invent facts, prices, or promises.
- Return ONLY a JSON array of 3 strings.`;
}

/**
 * Pure: normalize the model output into [{ text, goal }]. Accepts a JSON array
 * of strings/objects, or falls back to splitting numbered/bulleted lines.
 */
function shapeOptions(raw, goal) {
  const g = normalizeGoal(goal);
  let items = [];
  const text = String(raw == null ? '' : raw).trim();

  const tryParse = (s) => { try { return JSON.parse(s); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\[[\s\S]*\]/);
    if (m) parsed = tryParse(m[0]);
  }

  if (Array.isArray(parsed)) {
    items = parsed.map((x) => (typeof x === 'string' ? x : (x && x.text) || '')).filter(Boolean);
  } else {
    // Fallback: line split, strip leading numbering/bullets/quotes.
    items = text.split('\n')
      .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }

  const seen = new Set();
  const options = [];
  for (const t of items) {
    const clean = t.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) { seen.add(key); options.push({ text: clean, goal: g }); }
    if (options.length >= 3) break;
  }
  return options;
}

/**
 * Generate first-comment options. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage? }
 */
async function generateFirstComments(input, deps) {
  const { platform, goal, sourceText } = input || {};
  const safe = deps.sanitize(sourceText, 1500);
  if (!safe || !String(safe).trim()) {
    const e = new Error('post text is required'); e.statusCode = 400; throw e;
  }
  const prompt = buildPrompt({ platform, goal, sourceText: safe });
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: 400 });
  }
  const raw = await deps.generate(prompt, { maxTokens: 400, temperature: 0.8, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((raw || '').length / 4),
      taskType: 'first-comment',
    });
  }
  return { platform, goal: normalizeGoal(goal), options: shapeOptions(raw, goal) };
}

module.exports = {
  GOALS,
  DEFAULT_GOAL,
  normalizeGoal,
  buildPrompt,
  shapeOptions,
  generateFirstComments,
};
