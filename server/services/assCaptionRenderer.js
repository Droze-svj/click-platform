/**
 * assCaptionRenderer — turn caption segments + word timings into an ASS subtitle
 * file that ffmpeg burns in through libass.
 *
 * WHY THIS EXISTS
 * The previous caption path built one `drawtext` filter per line (and, in word
 * mode, one per WORD) and comma-joined them into a single chain. That approach
 * has three ceilings it can never clear, documented in videoRenderService's own
 * comments:
 *   1. Animating `fontsize` SIGSEGVs ffmpeg, so every "pop"/"scale"/"bounce"
 *      reveal silently degraded to a plain alpha fade. The size punch that
 *      defines modern captions was simply absent from exports.
 *   2. Word mode showed ONE WORD AT A TIME, centered, with no surrounding line.
 *   3. Text metrics were guessed (a 0.58em monospace approximation), so
 *      wrapping and any per-word positioning drifted on proportional fonts.
 *
 * libass has none of those limits: `\t()` animates scale safely, a line renders
 * with real font metrics, and per-word colour is an inline override. It is also
 * ONE filter instead of N, and it renders emoji inline rather than as a separate
 * pass that got dropped whenever no colour emoji font was installed.
 *
 * The output plugs into the `ass=` filter that videoRenderService ALREADY builds
 * (it reads `exportOptions.subtitlePath`) — that socket existed, correctly
 * escaped, with nothing ever plugged into it.
 *
 * THE TECHNIQUE (what beats one-word-at-a-time)
 * For a line of N words in `karaoke: 'word'` mode we emit N Dialogue events, each
 * covering one word's spoken window and rendering the FULL line with only the
 * active word overridden:
 *
 *   {\c&H00D7FF&\fscx118\fscy118\t(0,90,\fscx100\fscy100)}INSANE{\r}
 *
 * giving full-line context, per-word colour, and a real scale punch at once.
 * libass handles hundreds of events trivially; this is still a single filter.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveCaptionStyleOrDefault, toAssStyle, hexToAssColor } = require('./captionStyleRegistry');
const logger = require('../utils/logger');

// The exact field order libass expects for a V4+ style line.
const STYLE_FIELDS = [
  'Name', 'Fontname', 'Fontsize', 'PrimaryColour', 'SecondaryColour',
  'OutlineColour', 'BackColour', 'Bold', 'Italic', 'Underline', 'StrikeOut',
  'ScaleX', 'ScaleY', 'Spacing', 'Angle', 'BorderStyle', 'Outline', 'Shadow',
  'Alignment', 'MarginL', 'MarginR', 'MarginV', 'Encoding',
];

/**
 * Seconds → ASS `H:MM:SS.cc`.
 *
 * The `.cc` field is CENTISECONDS, not decimal seconds — the inverse of
 * aiTranscriptionService.assTimeToSeconds. Rounding can carry to 100cs, which
 * would emit an invalid `.100`, so the carry is handled explicitly.
 */
function secondsToAssTime(sec) {
  let s = Math.max(0, Number(sec) || 0);
  let cs = Math.round((s - Math.floor(s)) * 100);
  let whole = Math.floor(s);
  if (cs >= 100) { cs -= 100; whole += 1; }
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const ss = whole % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * Make text safe inside a Dialogue line.
 *
 * `{` and `}` delimit ASS override blocks and `\` starts an override tag, so a
 * caption containing them would inject styling (or break the line). They are
 * substituted rather than escaped because ASS has no reliable literal escape for
 * them. Real newlines become `\N`, ASS's explicit line break.
 */
function escapeAssText(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n?|\n/g, '\\N')
    .replace(/\\(?!N)/g, '/')
    .replace(/\{/g, '(')
    .replace(/\}/g, ')')
    .trim();
}

/**
 * Normalize a word for keyword matching — Unicode-aware.
 *
 * The old server-side twin stripped `[^a-z0-9]`, which erased every accented and
 * non-Latin word, so highlight matching diverged from the client (whose helper
 * is NFKC + \p{L}\p{N}). This matches the client so preview and export agree.
 */
function normWord(s) {
  return String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '');
}

const wStart = (w) => Number(w && (w.start ?? w.startTime));
const wEnd = (w) => Number(w && (w.end ?? w.endTime));
const wText = (w) => String((w && (w.word ?? w.text)) ?? '');

/** Keep only words with a sane, finite, forward time window. */
function usableWords(words) {
  if (!Array.isArray(words)) return [];
  return words.filter((w) => {
    const s = wStart(w);
    const e = wEnd(w);
    return wText(w).trim() && Number.isFinite(s) && Number.isFinite(e) && e > s;
  });
}

/** Split words into lines of at most `maxPerLine`. */
function groupIntoLines(words, maxPerLine) {
  const per = Math.max(1, Math.round(Number(maxPerLine) || 4));
  const out = [];
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per));
  return out;
}

/** Greedy word-wrap for caption text with no word timings. */
function wrapPlain(text, maxPerLine) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return groupIntoLines(words, maxPerLine).map((g) => g.join(' '));
}

function applyCase(text, style) {
  return style.uppercase ? String(text).toUpperCase() : String(text);
}

/**
 * `#RRGGBB` → an inline `\c` colour override.
 *
 * The inline form is `&HBBGGRR&` — BGR like every ASS colour, but WITHOUT the
 * leading alpha byte a Style line carries, and WITH a closing `&`. libass
 * tolerates the missing terminator; the spec does not, so emit it.
 */
function inlineColour(hex) {
  return `\\c${hexToAssColor(hex).replace(/^&H[0-9A-F]{2}/, '&H')}&`;
}

function dialogue(startSec, endSec, text) {
  return `Dialogue: 0,${secondsToAssTime(startSec)},${secondsToAssTime(endSec)},Click,,0,0,0,,${text}`;
}

/**
 * Build the Dialogue events for one line of timed words in `karaoke: 'word'`
 * mode — the full line repeated once per word, with the active word emphasised.
 */
function wordModeEvents(lineWords, style, highlightSet) {
  const events = [];
  const popMs = 90;

  for (let i = 0; i < lineWords.length; i++) {
    const start = wStart(lineWords[i]);
    // Hold each word until the next one starts so the line never blanks between
    // words (a gap in the transcript would otherwise flicker the caption off).
    const next = lineWords[i + 1];
    const end = next ? Math.max(wEnd(lineWords[i]), wStart(next)) : wEnd(lineWords[i]);

    const rendered = lineWords.map((w, j) => {
      const raw = applyCase(escapeAssText(wText(w)), style);
      const isActive = j === i;
      const isKeyword = highlightSet.has(normWord(wText(w)));

      if (isActive) {
        const colour = inlineColour(style.highlight);
        const pop = style.wordAnim === 'pop' && style.popScale !== 100
          ? `\\fscx${style.popScale}\\fscy${style.popScale}\\t(0,${popMs},\\fscx100\\fscy100)`
          : '';
        return `{${colour}${pop}}${raw}{\\r}`;
      }
      // A designated keyword stays accented through the whole line (the
      // Hormozi look) rather than only while it is being spoken.
      if (isKeyword) return `{${inlineColour(style.highlight)}}${raw}{\\r}`;
      return raw;
    }).join(' ');

    if (end > start) events.push(dialogue(start, end, rendered));
  }
  return events;
}

/**
 * Build the single Dialogue event for a line in `karaoke: 'sweep'` mode, using
 * ASS's native `\kf` progressive fill. Durations are CENTISECONDS.
 */
function sweepModeEvent(lineWords, style) {
  const start = wStart(lineWords[0]);
  const end = wEnd(lineWords[lineWords.length - 1]);
  if (!(end > start)) return [];

  const parts = lineWords.map((w, i) => {
    const next = lineWords[i + 1];
    const wordEnd = next ? Math.max(wEnd(w), wStart(next)) : wEnd(w);
    const cs = Math.max(1, Math.round((wordEnd - wStart(w)) * 100));
    return `{\\kf${cs}}${applyCase(escapeAssText(wText(w)), style)}`;
  });

  return [dialogue(start, end, `{\\fad(60,50)}${parts.join(' ')}`)];
}

/** Build the events for a caption rendered as a static line. */
function staticEvents(caption, style) {
  const start = Number(caption.start ?? caption.startTime);
  const end = Number(caption.end ?? caption.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];

  const lines = wrapPlain(caption.text, style.maxWordsPerLine);
  if (!lines.length) return [];
  const text = applyCase(lines.map(escapeAssText).join('\\N'), style);
  return [dialogue(start, end, `{\\fad(60,50)}${text}`)];
}

/**
 * PURE: caption segments → a complete ASS document.
 *
 * `captions` accepts the shapes already in the codebase: `{text, start, end}`,
 * `{text, startTime, endTime}`, and either with a `words[]` array of
 * `{word|text, start|startTime, end|endTime}`.
 */
function buildAssDocument({ captions = [], styleId = 'default', frame = {}, options = {} } = {}) {
  const style = resolveCaptionStyleOrDefault(styleId);
  const width = Math.max(2, Math.round(Number(frame.width) || 1080));
  const height = Math.max(2, Math.round(Number(frame.height) || 1920));
  const assStyle = toAssStyle(styleId, { width, height });

  const header = [
    '[Script Info]',
    '; Generated by Click — assCaptionRenderer',
    'ScriptType: v4.00+',
    // PlayRes MUST match the output frame, or libass scales every margin and
    // font size against a different canvas than the one being rendered.
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    // 2 = no automatic wrapping; line breaks come from our own \N, so wrapping
    // stays under the same maxWordsPerLine rule the preview uses.
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.709',
    '',
    '[V4+ Styles]',
    `Format: ${STYLE_FIELDS.join(', ')}`,
    `Style: ${STYLE_FIELDS.map((f) => assStyle[f]).join(',')}`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const globalHighlights = new Set(
    (Array.isArray(options.highlightWords) ? options.highlightWords : [])
      .map(normWord).filter(Boolean),
  );

  const events = [];
  for (const caption of Array.isArray(captions) ? captions : []) {
    if (!caption) continue;

    const highlightSet = new Set([
      ...globalHighlights,
      ...(Array.isArray(caption.highlightWords) ? caption.highlightWords : [])
        .map(normWord).filter(Boolean),
    ]);

    const words = usableWords(caption.words);

    // No usable word timings → a static line. Honest: we do NOT fabricate
    // per-word timings here, because evenly-spaced fake karaoke reads as
    // out-of-sync and is worse than a clean static caption.
    if (!words.length || style.karaoke === 'none') {
      events.push(...staticEvents(caption, style));
      continue;
    }

    for (const lineWords of groupIntoLines(words, style.maxWordsPerLine)) {
      if (!lineWords.length) continue;
      events.push(...(style.karaoke === 'sweep'
        ? sweepModeEvent(lineWords, style)
        : wordModeEvents(lineWords, style, highlightSet)));
    }
  }

  return `${header.concat(events).join('\n')}\n`;
}

/** Write an ASS document to `dir`, returning its path. */
function writeAssFile(doc, { dir, name } = {}) {
  const target = dir || require('os').tmpdir();
  fs.mkdirSync(target, { recursive: true });
  const file = path.join(
    target,
    name || `click-captions-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.ass`,
  );
  fs.writeFileSync(file, doc, 'utf8');
  return file;
}

/**
 * Build + write the ASS file for a render.
 *
 * Returns `{ path, cleanup }`, or null when there is nothing to burn in — the
 * caller then simply never sets `exportOptions.subtitlePath` and the render
 * proceeds without a caption pass. `cleanup()` is safe to call more than once
 * and must be invoked from the render's `finally` so no .ass file is left behind.
 */
function renderCaptionsToAss({ captions, styleId, frame, tmpDir, options } = {}) {
  const list = Array.isArray(captions) ? captions.filter(Boolean) : [];
  if (!list.length) return null;

  const doc = buildAssDocument({ captions: list, styleId, frame, options });
  // A document with a header but no Dialogue rows would add a no-op filter.
  if (!/^Dialogue:/m.test(doc)) {
    logger.info('[ass] no dialogue events produced — skipping caption burn-in', {
      styleId, captionCount: list.length,
    });
    return null;
  }

  const file = writeAssFile(doc, { dir: tmpDir });
  logger.info('[ass] caption file written', {
    path: file,
    styleId,
    events: (doc.match(/^Dialogue:/gm) || []).length,
  });

  let done = false;
  return {
    path: file,
    cleanup() {
      if (done) return;
      done = true;
      try { fs.unlinkSync(file); } catch (_) { /* already gone — fine */ }
    },
  };
}

module.exports = {
  buildAssDocument,
  writeAssFile,
  renderCaptionsToAss,
  // exported for unit tests
  secondsToAssTime,
  escapeAssText,
  normWord,
  groupIntoLines,
  wrapPlain,
};
