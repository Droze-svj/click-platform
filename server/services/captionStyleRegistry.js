/**
 * captionStyleRegistry — ONE source of truth for named caption styles.
 *
 * Before this registry there were FOUR divergent caption style maps and THREE
 * non-intersecting vocabularies:
 *   - videoRenderService.CAPTION_STYLE_MAP  (6 ids, the only ones that rendered)
 *   - aiVideoEditingService  (a duplicate map with stale FIXED-PIXEL y values,
 *     plus a second styleOptions list naming web fonts ffmpeg cannot resolve)
 *   - aiDirectorService      (a 12-name vocabulary)
 *   - clipStylePresets       (10 more captionStyle strings)
 * Every name outside the first list fell through to `default` at render time, so
 * a user could pick "neon" and export plain white text. This unifies them: one
 * canonical list, aliases absorbing every legacy spelling, and ONE record shape
 * that drives BOTH the ASS style line (export) and the CSS bag (preview).
 *
 * Modeled deliberately on colorGradeRegistry.js — same shape, same ALIASES idea,
 * same client-mirror + parity-test discipline.
 *
 * IMPORTANT: keep this file's ids in sync with client/lib/captionStyles.ts.
 * tests/server/captionStyleRegistry.test.js fails the build if they drift.
 */

'use strict';

/**
 * A caption style record.
 *
 *  fontFamily     fontconfig family name (ASS `Fontname`). Must be a family the
 *                 render host actually has — see Dockerfile's font packages.
 *  fontSize       baseline for a 1080-WIDE frame; the ASS renderer scales it to
 *                 the real output width, matching the drawtext convention.
 *  primary        base/spoken text colour        (#RRGGBB)
 *  secondary      un-spoken colour for `karaoke: 'sweep'` (ASS SecondaryColour)
 *  highlight      keyword / active-word colour
 *  outline        outline (ASS OutlineColour); outlineW in px @1080
 *  shadow         shadow depth in px @1080
 *  box            false | 'opaque'  → ASS BorderStyle 3 (boxed caption)
 *  align          ASS numpad alignment (2 = bottom-center, 5 = middle-center)
 *  marginVPct     bottom margin as a FRACTION of frame height (never fixed px —
 *                 a fixed offset lands mid-frame on a different aspect)
 *  karaoke        'word'  → active word recoloured + popped (Submagic/Choppity look)
 *                 'sweep' → classic \kf progressive fill
 *                 'none'  → static line
 *  wordAnim       'pop' → \t() scale punch on the active word (drawtext CANNOT do this)
 *  popScale       \fscx/\fscy percentage at the start of the pop
 */
const CAPTION_STYLES = [
  // ── Creator-recognisable styles (the competitive set) ──────────────────────
  {
    id: 'hormozi', label: 'Hormozi',
    fontFamily: 'Montserrat', fontSize: 82,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700',
    outline: '#000000', outlineW: 5, shadow: 2, box: false,
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 118,
    swatch: 'from-yellow-300 via-amber-400 to-yellow-500',
  },
  {
    id: 'mrbeast', label: 'MrBeast',
    fontFamily: 'Liberation Sans', fontSize: 88,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FF3B30',
    outline: '#000000', outlineW: 6, shadow: 3, box: false,
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.17,
    maxWordsPerLine: 3, karaoke: 'word', wordAnim: 'pop', popScale: 125,
    swatch: 'from-red-400 via-rose-500 to-orange-500',
  },
  {
    id: 'karaoke-fill', label: 'Karaoke Fill',
    fontFamily: 'Montserrat', fontSize: 74,
    primary: '#FFE500', secondary: '#FFFFFF', highlight: '#FFE500',
    outline: '#000000', outlineW: 4, shadow: 2, box: false,
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18,
    maxWordsPerLine: 5, karaoke: 'sweep', wordAnim: 'none', popScale: 100,
    swatch: 'from-yellow-200 via-yellow-400 to-amber-500',
  },
  {
    id: 'clean-minimal', label: 'Clean Minimal',
    fontFamily: 'Liberation Sans', fontSize: 58,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFFFFF',
    outline: '#000000', outlineW: 2, shadow: 1, box: false,
    uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.14,
    maxWordsPerLine: 7, karaoke: 'none', wordAnim: 'none', popScale: 100,
    swatch: 'from-gray-200 via-gray-300 to-gray-400',
  },
  {
    id: 'neon', label: 'Neon',
    fontFamily: 'Montserrat', fontSize: 72,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#00F5FF',
    outline: '#00A0B0', outlineW: 4, shadow: 4, box: false,
    uppercase: true, letterSpacing: 1, align: 2, marginVPct: 0.18,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 115,
    swatch: 'from-cyan-300 via-sky-400 to-blue-500',
  },
  {
    id: 'pill', label: 'Pill',
    fontFamily: 'Liberation Sans', fontSize: 62,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700',
    outline: '#000000', outlineW: 0, shadow: 0, box: 'opaque',
    uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.16,
    maxWordsPerLine: 5, karaoke: 'word', wordAnim: 'none', popScale: 100,
    swatch: 'from-slate-700 via-slate-800 to-black',
  },
  {
    id: 'sticker', label: 'Sticker',
    fontFamily: 'Montserrat', fontSize: 68,
    primary: '#111111', secondary: '#111111', highlight: '#E11D48',
    outline: '#FFFFFF', outlineW: 5, shadow: 3, box: false,
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 120,
    swatch: 'from-white via-rose-200 to-rose-400',
  },
  {
    id: 'cyberpunk', label: 'Cyberpunk',
    fontFamily: 'Montserrat', fontSize: 74,
    primary: '#E9FBFF', secondary: '#E9FBFF', highlight: '#FF2D95',
    outline: '#1B0033', outlineW: 4, shadow: 4, box: false,
    uppercase: true, letterSpacing: 2, align: 2, marginVPct: 0.19,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 122,
    swatch: 'from-fuchsia-500 via-purple-500 to-cyan-400',
  },
  {
    id: 'serif-doc', label: 'Documentary',
    fontFamily: 'Liberation Serif', fontSize: 54,
    primary: '#F5F5F0', secondary: '#F5F5F0', highlight: '#E8C57A',
    outline: '#000000', outlineW: 2, shadow: 2, box: false,
    uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.12,
    maxWordsPerLine: 8, karaoke: 'none', wordAnim: 'none', popScale: 100,
    swatch: 'from-stone-300 via-stone-500 to-stone-700',
  },

  // ── The six legacy CAPTION_STYLE_MAP ids, preserved so nothing regresses ───
  // Values mirror videoRenderService.CAPTION_STYLE_MAP (fontColor/fontSize/
  // borderColor/borderw/shadow) so an existing project renders the same look.
  {
    id: 'hook', label: 'Hook',
    fontFamily: 'Liberation Sans', fontSize: 82,
    primary: '#FFD700', secondary: '#FFD700', highlight: '#FFFFFF',
    outline: '#FFD700', outlineW: 4, shadow: 4, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1875,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 118,
    swatch: 'from-yellow-300 to-amber-500',
  },
  {
    id: 'stat', label: 'Stat',
    fontFamily: 'Liberation Sans', fontSize: 72,
    primary: '#00FFFF', secondary: '#00FFFF', highlight: '#FFFFFF',
    outline: '#00FFFF', outlineW: 3, shadow: 3, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 115,
    swatch: 'from-cyan-300 to-teal-500',
  },
  {
    id: 'question', label: 'Question',
    fontFamily: 'Liberation Sans', fontSize: 64,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700',
    outline: '#FFFFFF', outlineW: 2, shadow: 2, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 5, marginVPct: 0.45,
    maxWordsPerLine: 5, karaoke: 'none', wordAnim: 'none', popScale: 100,
    swatch: 'from-white to-gray-400',
  },
  {
    id: 'punchline', label: 'Punchline',
    fontFamily: 'Liberation Sans', fontSize: 76,
    primary: '#FF3366', secondary: '#FF3366', highlight: '#FFFFFF',
    outline: '#FF3366', outlineW: 3, shadow: 4, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667,
    maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 122,
    swatch: 'from-rose-400 to-pink-600',
  },
  {
    id: 'cta', label: 'Call to Action',
    fontFamily: 'Liberation Sans', fontSize: 60,
    primary: '#FFD700', secondary: '#FFD700', highlight: '#FFFFFF',
    outline: '#FFD700', outlineW: 2, shadow: 2, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.125,
    maxWordsPerLine: 5, karaoke: 'none', wordAnim: 'none', popScale: 100,
    swatch: 'from-amber-300 to-yellow-500',
  },
  {
    id: 'default', label: 'Default',
    fontFamily: 'Liberation Sans', fontSize: 58,
    primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700',
    outline: '#000000', outlineW: 2, shadow: 2, box: 'opaque',
    uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667,
    maxWordsPerLine: 6, karaoke: 'none', wordAnim: 'none', popScale: 100,
    swatch: 'from-gray-300 to-gray-500',
  },
];

/**
 * Legacy / alternate spellings → canonical id.
 *
 * Every string that any of the four old maps, the AI Director vocabulary, the
 * clip-style presets, or the five client pickers could have stored. A value
 * missing here silently becomes `default` — which is exactly the bug this
 * registry exists to end — so prefer adding an alias over dropping one.
 */
const ALIASES = {
  // clipStylePresets captionStyle strings
  'bold-kinetic': 'hormozi',
  'bold': 'mrbeast',
  'tiktok': 'hormozi',
  'tiktok-pop': 'hormozi',
  'minimal': 'clean-minimal',
  'modern': 'clean-minimal',
  'professional': 'serif-doc',
  'outline': 'mrbeast',
  'serif': 'serif-doc',
  // aiDirectorService vocabulary
  'kinetic': 'hormozi',
  'karaoke': 'karaoke-fill',
  'gradient': 'neon',
  'pop': 'sticker',
  'bubble': 'pill',
  'cinematic': 'serif-doc',
  // client CAPTION_TEXT_STYLES ids not already canonical
  'uppercase': 'mrbeast',
  'shadow': 'clean-minimal',
  'high-contrast': 'clean-minimal',
  'subtitle': 'clean-minimal',
  'retro': 'sticker',
  'vintage': 'serif-doc',
  // client CAPTION_CREATIVE_PRESETS ids not already canonical
  'reels': 'hormozi',
  'podcast': 'serif-doc',
  'documentary': 'serif-doc',
  'accessible': 'clean-minimal',
  // misc legacy spellings
  'neon-glitch': 'cyberpunk',
  'cyberpunk_neon': 'cyberpunk',
  'hormozi-bold': 'hormozi',
  'mrbeast-energy': 'mrbeast',
  'none': 'default',
};

const _byId = new Map(CAPTION_STYLES.map((s) => [s.id, s]));

/** Canonicalize an id: trim, lowercase (so a stored `CTA` resolves), de-alias. */
function normalizeId(id) {
  const key = String(id || '').trim().toLowerCase();
  return ALIASES[key] || key;
}

/** Resolve a style (alias-aware) → its record, or null for an unknown id. */
function resolveCaptionStyle(id) {
  return _byId.get(normalizeId(id)) || null;
}

/** A resolved record, always — unknown ids fall back to `default`. */
function resolveCaptionStyleOrDefault(id) {
  return resolveCaptionStyle(id) || _byId.get('default');
}

/** All canonical ids — the AI Director's `caption` step vocabulary. */
function captionStyleIds() {
  return CAPTION_STYLES.map((s) => s.id);
}

/**
 * The creator's most-used caption style, from their learned UserStyleProfile
 * `captionStyles` counters.
 *
 * Counters hold whatever id the editor wrote at the time — including legacy
 * spellings like `bold-kinetic` or `tiktok` — so each is resolved through the
 * alias map rather than compared literally. Returns null when nothing has been
 * learned yet, so callers fall back to their own default instead of guessing a
 * preference the creator never expressed.
 */
function preferredStyleFrom(counters) {
  if (!Array.isArray(counters) || counters.length === 0) return null;
  let best = null;
  for (const c of counters) {
    const key = c && (c.key ?? c.id);
    const count = Number(c && c.count) || 0;
    if (!key || count <= 0) continue;
    const rec = resolveCaptionStyle(key);
    if (!rec) continue;
    if (!best || count > best.count) best = { id: rec.id, count };
  }
  return best ? best.id : null;
}

/**
 * '#RRGGBB' → ASS '&HBBGGRR&'.
 *
 * ASS colours are BGR, not RGB — the single most common way to get this format
 * wrong. Alpha is a SEPARATE leading byte and is INVERTED (00 = opaque,
 * FF = fully transparent), which is why `alpha` here is "0 = solid".
 */
function hexToAssColor(hex, alpha = 0) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
  const rgb = m ? m[1] : 'ffffff';
  const r = rgb.slice(0, 2);
  const g = rgb.slice(2, 4);
  const b = rgb.slice(4, 6);
  const a = Math.max(0, Math.min(255, Math.round(Number(alpha) || 0)))
    .toString(16).padStart(2, '0');
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

/**
 * A style + output frame → the field values for an ASS `Style:` line.
 *
 * Sizes are scaled from the 1080-wide baseline to the real frame so captions are
 * the same PROPORTION on 9:16 / 1:1 / 16:9, and MarginV is derived from
 * marginVPct so it is never a fixed pixel offset.
 */
function toAssStyle(styleId, frame = {}) {
  const s = resolveCaptionStyleOrDefault(styleId);
  const width = Math.max(2, Math.round(Number(frame.width) || 1080));
  const height = Math.max(2, Math.round(Number(frame.height) || 1920));
  const scale = width / 1080;

  return {
    Name: 'Click',
    Fontname: s.fontFamily,
    Fontsize: Math.max(8, Math.round(s.fontSize * scale)),
    // In sweep karaoke the UNSUNG colour is Secondary and the sung colour is
    // Primary; libass swaps them as \k advances.
    PrimaryColour: hexToAssColor(s.karaoke === 'sweep' ? s.highlight : s.primary),
    SecondaryColour: hexToAssColor(s.secondary),
    OutlineColour: hexToAssColor(s.outline),
    BackColour: hexToAssColor('#000000', 128),
    Bold: -1,
    Italic: 0,
    Underline: 0,
    StrikeOut: 0,
    ScaleX: 100,
    ScaleY: 100,
    Spacing: Math.round((Number(s.letterSpacing) || 0) * scale),
    Angle: 0,
    // 1 = outline + drop shadow, 3 = opaque box behind the text.
    BorderStyle: s.box === 'opaque' ? 3 : 1,
    Outline: Math.max(0, Math.round(s.outlineW * scale)),
    Shadow: Math.max(0, Math.round(s.shadow * scale)),
    Alignment: s.align,
    MarginL: Math.round(width * 0.04),
    MarginR: Math.round(width * 0.04),
    MarginV: Math.round(height * s.marginVPct),
    Encoding: 1,
  };
}

/**
 * A style → a CSS bag for the live preview. The server keeps this so a test can
 * assert both renderings derive from ONE record; the browser preview uses the
 * mirror in client/lib/captionStyles.ts (kept in id-parity by CI).
 */
function toCssBag(styleId) {
  const s = resolveCaptionStyleOrDefault(styleId);
  const css = {
    color: s.primary,
    fontWeight: 800,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
    textTransform: s.uppercase ? 'uppercase' : undefined,
  };
  if (s.box === 'opaque') {
    css.backgroundColor = 'rgba(0,0,0,0.85)';
    css.padding = '0.12em 0.5em';
    css.borderRadius = s.id === 'pill' ? '9999px' : '0.35em';
  } else {
    css.WebkitTextStroke = `${s.outlineW}px ${s.outline}`;
    css.paintOrder = 'stroke fill';
    css.textShadow = s.shadow ? `0 ${s.shadow}px ${s.shadow * 3}px rgba(0,0,0,0.85)` : undefined;
  }
  return css;
}

module.exports = {
  CAPTION_STYLES,
  ALIASES,
  normalizeId,
  resolveCaptionStyle,
  resolveCaptionStyleOrDefault,
  captionStyleIds,
  preferredStyleFrom,
  hexToAssColor,
  toAssStyle,
  toCssBag,
};
