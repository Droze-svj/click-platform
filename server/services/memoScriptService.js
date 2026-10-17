// Voice Memo → Script
// Turns a creator's raw, rambling voice memo (or typed "raw thoughts") into a
// structured, ready-to-record script: # Hook (the first ~3 seconds), # Body
// (beats), # CTA — plus B-roll cues and a list of factual claims to verify.
// Then runs a deterministic QA pass (hook length, banned words, CTA present,
// runtime vs. target, unverified numbers) before the creator approves it.
// Pure prompt/parse/QA core + injectable AI so it is unit-testable, mirroring
// the other feature services.

// Target formats: spoken runtime window (seconds) + how many body beats to aim for.
const FORMATS = {
  short: { label: 'Short-form (Reels/TikTok/Shorts)', minSec: 20, maxSec: 60, beats: '3-5' },
  long: { label: 'Long-form (YouTube)', minSec: 240, maxSec: 720, beats: '5-8' },
};
const DEFAULT_FORMAT = 'short';

// A hook must land inside ~3 seconds; at a brisk ~3.5 spoken words/second
// that is roughly a dozen words.
const HOOK_MAX_WORDS = 12;
// Average conversational delivery used to estimate spoken runtime.
const WORDS_PER_MINUTE = 150;
const MAX_MEMO_CHARS = 6000; // ~2 minutes of speech is ~300 words; leave headroom.

function normalizeFormat(format) {
  return FORMATS[format] ? format : DEFAULT_FORMAT;
}

function countWords(text) {
  const t = String(text == null ? '' : text).trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Pure: build the generation prompt for a memo.
 */
function buildPrompt({ memo, platform, format }) {
  const f = FORMATS[normalizeFormat(format)];
  return `You are a script editor for a solo creator. Below is a RAW voice memo — rambling,
out of order, full of filler. Turn it into a tight script the creator can record for ${platform}.
Format: ${f.label}. Spoken runtime ${f.minSec}-${f.maxSec} seconds. Aim for ${f.beats} body beats.

Raw memo:
"""
${memo}
"""
Rules:
- Keep the creator's OWN ideas, opinions and examples. Do not add new claims, stats, prices or promises.
- Reuse the creator's own words and phrases from the memo wherever they work. No marketing or growth jargon
  they did not use (e.g. "retention", "algorithm", "arbitrage", "engagement", "leverage").
- Never write placeholders like "XYZ", "[product]" or "TBD". If a detail is missing, phrase around it.
- "hook": the first 3 seconds — ONE line, max ${HOOK_MAX_WORDS} words, specific and scroll-stopping.
- "body": an array of short spoken beats, in the order that best builds the argument.
- "cta": ONE clear next step for the viewer.
- "brollCues": short visual suggestions, each tied to a beat (e.g. "beat 2: close-up of an empty checkout page").
- "claims": every factual claim or number in the script that should be fact-checked before publishing (may be empty).
- Write how people talk: contractions, short sentences, no hashtags, no emojis, no "as an AI".
- Return ONLY JSON: {"title": string, "hook": string, "body": string[], "cta": string, "brollCues": string[], "claims": string[]}`;
}

const strList = (v) => (Array.isArray(v) ? v : [])
  .map((x) => (typeof x === 'string' ? x : (x && (x.text || x.line)) || ''))
  .map((x) => String(x).trim())
  .filter(Boolean);

/**
 * Pure: normalize the model output into a script object, or null when the
 * reply has no usable hook/body/cta (the caller reports that honestly instead
 * of handing the creator a canned template).
 */
function shapeScript(raw) {
  const text = String(raw == null ? '' : raw).trim();
  const tryParse = (str) => { try { return JSON.parse(str); } catch (_) { return null; } };
  let parsed = tryParse(text);
  if (!parsed) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const hook = typeof parsed.hook === 'string' ? parsed.hook.trim() : '';
  const body = strList(parsed.body);
  const cta = typeof parsed.cta === 'string' ? parsed.cta.trim() : '';
  if (!hook || !body.length || !cta) return null;

  return {
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : hook,
    hook,
    body,
    cta,
    brollCues: strList(parsed.brollCues),
    claims: strList(parsed.claims),
  };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Pure: deterministic QA checks run before the creator signs off.
 * Returns { passed, estimatedSeconds, checks: [{ id, ok, message }] }.
 * `passed` ignores the informational fact-check item — flagged claims need a
 * human look, they are not a failure of the script.
 */
function qaCheck(script, { format, banned = [] } = {}) {
  const f = FORMATS[normalizeFormat(format)];
  const spoken = [script.hook, ...script.body, script.cta].join(' ');
  const words = countWords(spoken);
  const estimatedSeconds = Math.round((words / WORDS_PER_MINUTE) * 60);
  const checks = [];

  const hookWords = countWords(script.hook);
  checks.push({
    id: 'hook-length',
    ok: hookWords <= HOOK_MAX_WORDS,
    message: hookWords <= HOOK_MAX_WORDS
      ? `Hook is ${hookWords} words, short enough to land in 3 seconds.`
      : `Hook is ${hookWords} words; cut it to ${HOOK_MAX_WORDS} or fewer so it lands in 3 seconds.`,
  });

  const bannedList = (Array.isArray(banned) ? banned : [])
    .map((w) => String(w || '').trim())
    .filter(Boolean);
  const hits = bannedList.filter((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(w)}($|[^\\p{L}\\p{N}])`, 'iu').test(spoken));
  checks.push({
    id: 'banned-words',
    ok: hits.length === 0,
    message: hits.length === 0
      ? (bannedList.length ? 'No banned words.' : 'No banned words set in your AI preferences.')
      : `Uses banned words: ${hits.join(', ')}.`,
  });

  // A script is recorded as written — an unfilled "XYZ"/"[product]" would be
  // read out loud on camera.
  const placeholders = spoken.match(/\b(?:XYZ|TBD|TODO|lorem ipsum)\b|\[[^\]]{1,40}\]|\{[^}]{1,40}\}/gi) || [];
  checks.push({
    id: 'placeholders',
    ok: placeholders.length === 0,
    message: placeholders.length === 0
      ? 'No unfilled placeholders.'
      : `Fill in before recording: ${[...new Set(placeholders)].join(', ')}.`,
  });

  checks.push({
    id: 'cta',
    ok: Boolean(script.cta),
    message: script.cta ? 'Ends with a call to action.' : 'Missing a call to action.',
  });

  const inRange = estimatedSeconds >= f.minSec && estimatedSeconds <= f.maxSec;
  checks.push({
    id: 'runtime',
    ok: inRange,
    message: inRange
      ? `About ${estimatedSeconds}s spoken, inside the ${f.minSec}-${f.maxSec}s target.`
      : `About ${estimatedSeconds}s spoken; the target is ${f.minSec}-${f.maxSec}s.`,
  });

  const passed = checks.every((c) => c.ok);

  // Informational: numbers/percentages/money in the script, or claims the model
  // flagged, need verifying before anything goes public.
  const numeric = spoken.match(/[$€£]\s?\d[\d,.]*|\d[\d,.]*\s?(%|percent|x\b|k\b|m\b)/gi) || [];
  const toVerify = script.claims.length + numeric.length;
  checks.push({
    id: 'fact-check',
    ok: toVerify === 0,
    message: toVerify === 0
      ? 'No factual claims or numbers to verify.'
      : `Verify before publishing: ${script.claims.length} flagged claim(s)${numeric.length ? `, numbers: ${[...new Set(numeric.map((n) => n.trim()))].join(', ')}` : ''}.`,
  });

  return { passed, estimatedSeconds, checks };
}

/**
 * Pure: render the script as the script.md the creator records from.
 */
function toMarkdown(script) {
  const lines = [`# Hook`, '', script.hook, '', `# Body`, ''];
  script.body.forEach((beat) => lines.push(`- ${beat}`));
  lines.push('', `# CTA`, '', script.cta);
  if (script.brollCues.length) {
    lines.push('', `## B-roll cues`, '');
    script.brollCues.forEach((c) => lines.push(`- ${c}`));
  }
  if (script.claims.length) {
    lines.push('', `## Claims to verify`, '');
    script.claims.forEach((c) => lines.push(`- [ ] ${c}`));
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Pure: map a script onto the Script model so it lands in the Scripts library
 * (and can be sent for sign-off as an approval of entityType 'script').
 */
function toScriptDoc(script, { format, userId }) {
  const fmt = normalizeFormat(format);
  const words = countWords([script.hook, ...script.body, script.cta].join(' '));
  return {
    userId,
    title: script.title.slice(0, 200),
    type: fmt === 'long' ? 'youtube' : 'social-media',
    topic: script.title.slice(0, 200),
    tone: 'casual',
    duration: Math.round((words / WORDS_PER_MINUTE) * 10) / 10, // minutes
    wordCount: words,
    script: toMarkdown(script),
    structure: {
      introduction: script.hook,
      mainPoints: script.body.map((content, i) => ({ title: `Beat ${i + 1}`, content })),
      callToAction: script.cta,
    },
    metadata: { hooks: [script.hook] },
    status: 'draft',
  };
}

/**
 * Generate a script from a memo. External calls injected via `deps`:
 *   { sanitize, generate, assertBudget?, recordUsage?, buildSystemPrompt?, getBannedWords? }
 * Returns null when the model produced nothing usable.
 */
async function generateMemoScript(input, deps) {
  const { memo, platform = 'tiktok', format, userId } = input || {};
  const safe = deps.sanitize(memo, MAX_MEMO_CHARS);
  if (!safe || !String(safe).trim()) {
    const e = new Error('memo is required'); e.statusCode = 400; throw e;
  }
  const fmt = normalizeFormat(format);
  const { applyPersona } = require('../utils/applyPersona');
  const taskPrompt = buildPrompt({ memo: safe, platform, format: fmt });
  // script-writer, not creative-director: this task must return strict JSON.
  const prompt = await applyPersona(taskPrompt, { deps, userId, platform, stage: 'script', role: 'script-writer' });
  const maxTokens = fmt === 'long' ? 3000 : 1200;
  if (deps.assertBudget) {
    await deps.assertBudget({ provider: 'gemini', model: 'gemini-2.5-flash', prompt, expectedOutputTokens: maxTokens });
  }
  const raw = await deps.generate(prompt, { maxTokens, temperature: 0.7, thinkingBudget: 0 });
  if (deps.recordUsage) {
    await deps.recordUsage({
      provider: 'gemini', model: 'gemini-2.5-flash',
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: Math.ceil((raw || '').length / 4),
      taskType: 'memo-script',
    });
  }
  const script = shapeScript(raw);
  if (!script) return null;

  let banned = [];
  if (deps.getBannedWords && userId) {
    try { banned = (await deps.getBannedWords(userId)) || []; } catch (_) { banned = []; }
  }
  return {
    platform,
    format: fmt,
    script,
    qa: qaCheck(script, { format: fmt, banned }),
    markdown: toMarkdown(script),
  };
}

module.exports = {
  FORMATS,
  DEFAULT_FORMAT,
  HOOK_MAX_WORDS,
  WORDS_PER_MINUTE,
  MAX_MEMO_CHARS,
  normalizeFormat,
  countWords,
  buildPrompt,
  shapeScript,
  qaCheck,
  toMarkdown,
  toScriptDoc,
  generateMemoScript,
};
