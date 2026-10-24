// exportFonts — resolve an editor text overlay's font to a real font FILE for
// ffmpeg drawtext, so exported text uses the font the preview showed.
//
// Before this, every exported overlay used the render host's default sans
// (Liberation Sans) regardless of the font picked in the editor, and bold /
// italic were dropped. The editor and the renderer now share one set of
// open-licensed font files (client/public/fonts/export, built from
// google/fonts — see manifest.json). The browser loads them via @font-face
// (client/app/export-fonts.css) and the server reads the same files here.
//
// Proprietary system fonts the editor used to offer (Impact, Comic Sans,
// Georgia…) aren't on Linux render hosts and can't be bundled, so they map to
// their closest open equivalent — the editor shows that equivalent by name.

const fs = require('fs');
const path = require('path');

const FONT_DIR = path.resolve(__dirname, '../../client/public/fonts/export');

// CSS family (lower-case) → bundled family. Generic CSS families included.
const ALIASES = {
  impact: 'Anton',
  'arial black': 'Archivo Black',
  'comic sans ms': 'Comic Neue',
  'comic sans': 'Comic Neue',
  georgia: 'Gelasio',
  'times new roman': 'Gelasio',
  times: 'Gelasio',
  serif: 'Gelasio',
  'courier new': 'Courier Prime',
  courier: 'Courier Prime',
  monospace: 'JetBrains Mono',
  garamond: 'EB Garamond',
  verdana: 'Atkinson Hyperlegible',
  'trebuchet ms': 'Fira Sans',
  tahoma: 'PT Sans',
  'palatino linotype': 'Lora',
  palatino: 'Lora',
  'book antiqua': 'Lora',
  cursive: 'Caveat',
};
// Families that mean "the default sans" — the editor's UI font is Inter.
const DEFAULT_SANS = new Set(['inter', 'system-ui', 'sans-serif', 'arial', 'helvetica', 'helvetica neue', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'liberation sans']);

let _manifest;
function manifest() {
  if (_manifest === undefined) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(FONT_DIR, 'manifest.json'), 'utf8'));
      _manifest = Array.isArray(m.fonts) ? m.fonts : [];
    } catch (_) {
      _manifest = [];
    }
  }
  return _manifest;
}

/** Family names in a CSS font-family stack, unquoted, CSS vars dropped. */
function parseFamilies(css) {
  return String(css || '')
    .split(',')
    .map((f) => f.trim().replace(/^["']|["']$/g, '').trim())
    .filter((f) => f && !/^var\(/i.test(f));
}

/** First family in the stack we can render; Inter when none match. */
function bundledFamily(css) {
  const known = new Set(manifest().map((e) => e.family.toLowerCase()));
  for (const fam of parseFamilies(css)) {
    const lower = fam.toLowerCase();
    if (known.has(lower)) return manifest().find((e) => e.family.toLowerCase() === lower).family;
    if (ALIASES[lower]) return ALIASES[lower];
    if (DEFAULT_SANS.has(lower)) return 'Inter';
  }
  return 'Inter';
}

function covers(entry, text) {
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x20 || (cp >= 0xFE00 && cp <= 0xFE0F) || cp === 0x200D) continue; // spaces, variation selectors, ZWJ
    let ok = false;
    for (const [a, b] of entry.ranges) { if (cp >= a && cp <= b) { ok = true; break; } }
    if (!ok) return false;
  }
  return true;
}

/**
 * Resolve { family, weight, italic } (CSS-ish) to a bundled font file.
 * Returns { path, family, weight, italic, covers } or null when no bundled
 * fonts are available. `covers` is false when the text uses characters this
 * font doesn't have (e.g. Cyrillic in Bebas Neue) — callers then fall back to
 * a script font so nothing renders as empty boxes.
 */
function resolveExportFont({ family, weight, italic } = {}, text = '') {
  const fonts = manifest();
  if (!fonts.length) return null;
  const fam = bundledFamily(family);
  const want = Number(weight) || 400;
  const faces = fonts.filter((e) => e.family === fam);
  const pool = faces.filter((e) => e.italic === !!italic).length ? faces.filter((e) => e.italic === !!italic) : faces;
  // Nearest weight; on a tie prefer the heavier face (CSS-like for bold text).
  const face = pool.slice().sort((a, b) => (Math.abs(a.weight - want) - Math.abs(b.weight - want)) || (b.weight - a.weight))[0];
  if (!face) return null;
  const p = path.join(FONT_DIR, face.file);
  if (!fs.existsSync(p)) return null;
  if (covers(face, text)) return { path: p, family: face.family, weight: face.weight, italic: face.italic, covers: true };
  // The chosen font lacks some characters (e.g. Cyrillic in Bebas Neue): use the
  // closest bundled font that has them all, before the caller tries script fonts.
  const style = /serif/i.test(String(family)) && !/sans/i.test(String(family)) ? SERIF_FALLBACKS : SANS_FALLBACKS;
  for (const fam2 of style) {
    const alt = fonts.filter((e) => e.family === fam2 && !e.italic && covers(e, text))
      .sort((a, b) => Math.abs(a.weight - face.weight) - Math.abs(b.weight - face.weight))[0];
    if (alt && fs.existsSync(path.join(FONT_DIR, alt.file))) {
      return { path: path.join(FONT_DIR, alt.file), family: alt.family, weight: alt.weight, italic: false, covers: true, substituted: true };
    }
  }
  return { path: p, family: face.family, weight: face.weight, italic: face.italic, covers: false };
}

// Wide-coverage bundled families (Latin Extended, Cyrillic, Greek, Vietnamese).
const SANS_FALLBACKS = ['Inter', 'Roboto', 'Montserrat', 'Fira Sans', 'PT Sans'];
const SERIF_FALLBACKS = ['Lora', 'EB Garamond', 'Gelasio', 'Inter', 'Roboto'];

/** The font spec an overlay asks for: the editor-resolved one, else its own fields. */
function overlayFontSpec(overlay = {}) {
  const ef = overlay.exportFont;
  if (ef && typeof ef === 'object') {
    return { family: ef.family, weight: ef.weight, italic: !!ef.italic };
  }
  const w = overlay.fontWeight === 'bold' ? 700 : Number(overlay.fontWeight) || undefined;
  return { family: overlay.fontFamily, weight: w, italic: overlay.fontStyle === 'italic' };
}

module.exports = { resolveExportFont, overlayFontSpec, parseFamilies, bundledFamily, FONT_DIR };
