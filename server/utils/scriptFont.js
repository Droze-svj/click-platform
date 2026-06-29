// scriptFont — pick a glyph-covering font for non-Latin caption text.
//
// FFmpeg drawtext renders CJK / Arabic / Thai / Devanagari as tofu boxes (□□□)
// with a Latin font (Arial/DejaVu/Liberation). This resolves a script-appropriate
// Noto font WHEN one is installed on the render host, and returns null otherwise
// so callers fall back to their existing Latin default — additive, never a
// regression. Shared by aiVideoEditingService + videoRenderService so the Noto
// candidate list + detection live in ONE place.

const fs = require('fs');

const NOTO_FONT_CANDIDATES = {
  cjk: [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/truetype/noto-cjk/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
  ],
  arabic: [
    '/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoNaskhArabic-Regular.ttf',
    '/System/Library/Fonts/Supplemental/GeezaPro.ttc',
  ],
  thai: [
    '/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf',
    '/System/Library/Fonts/Supplemental/Thonburi.ttc',
  ],
  devanagari: [
    '/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf',
    '/System/Library/Fonts/Supplemental/DevanagariMT.ttc',
  ],
};

const _scriptFontCache = {};

// Latin default-font candidates (macOS / Linux / Windows), tried in order. Used
// when text has no special script (detectTextScript → null), and as the fallback
// when a Noto font for a non-Latin script isn't installed. Previously duplicated
// verbatim in videoRenderService.js AND aiVideoEditingService.js — now ONE list.
const SYSTEM_FONT_CANDIDATES = [
  // macOS Supplemental Fonts
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Helvetica.ttf',
  '/System/Library/Fonts/Supplemental/Verdana.ttf',
  '/System/Library/Fonts/Supplemental/Georgia.ttf',
  '/System/Library/Fonts/Supplemental/Impact.ttf',
  // macOS Core Fonts
  '/System/Library/Fonts/Helvetica.dfont',
  '/System/Library/Fonts/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
  '/Library/Fonts/Microsoft/Arial.ttf',
  // Linux truetype Fonts
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/Arial.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/arial.ttf',
  // Windows Fonts
  'C:\\Windows\\Fonts\\arial.ttf',
];

let _systemFontPath; // undefined = not resolved yet; null/string after.

/**
 * Resolves a valid TTF/OTF Latin font on the server's filesystem (to avoid
 * FFmpeg drawtext crashes when Sans/Arial defaults are missing). Cached.
 */
function getSystemFontPath() {
  if (_systemFontPath === undefined) {
    _systemFontPath = SYSTEM_FONT_CANDIDATES
      .find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } }) || null;
  }
  return _systemFontPath;
}

function detectTextScript(text) {
  const s = String(text || '');
  if (/[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF66-\uFF9D]/.test(s)) return 'cjk';
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(s)) return 'arabic';
  if (/[\u0E00-\u0E7F]/.test(s)) return 'thai';
  if (/[\u0900-\u097F]/.test(s)) return 'devanagari';
  return null;
}

/** Path to an installed Noto font covering `text`'s script, or null. Cached. */
function notoFontForText(text) {
  const script = detectTextScript(text);
  if (!script) return null;
  if (!(script in _scriptFontCache)) {
    _scriptFontCache[script] = (NOTO_FONT_CANDIDATES[script] || [])
      .find((p) => { try { return fs.existsSync(p); } catch (_) { return false; } }) || null;
  }
  return _scriptFontCache[script];
}

/**
 * The resolved font path for `text`: a script-covering Noto font when `text` is
 * non-Latin and one is installed, else the Latin system default (or null if no
 * font resolves at all). The single decision point every drawtext caller should use.
 */
function fontPathForText(text) {
  return notoFontForText(text) || getSystemFontPath();
}

/**
 * FFmpeg drawtext `:fontfile='...'` option string for `text`'s script, or ''
 * when no font resolves (so the caller's existing Latin default applies —
 * additive, never a regression). The path is escaped for the filter graph
 * (`\` → `/`, `:` → `\:`, e.g. a Windows `C:\…` drive path). Returned WITH the
 * leading colon so it concatenates directly after a `text='…'` token. Shared so
 * every drawtext surface (captions, overlays, thumbnails) selects fonts identically.
 */
function fontfileOptFor(text) {
  const p = fontPathForText(text);
  return p ? `:fontfile='${p.replace(/\\/g, '/').replace(/:/g, '\\:')}'` : '';
}

module.exports = { detectTextScript, notoFontForText, getSystemFontPath, fontPathForText, fontfileOptFor, SYSTEM_FONT_CANDIDATES };
