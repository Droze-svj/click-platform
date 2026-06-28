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

module.exports = { detectTextScript, notoFontForText };
