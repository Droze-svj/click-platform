/**
 * Shared FFmpeg drawtext-safety helpers.
 *
 * ffmpeg's `drawtext` filter is a notorious injection surface: user-supplied
 * text, colors and font paths get interpolated into a colon-delimited,
 * single-quoted filter string. An unescaped `'` `:` `\` `,` `;` `[` `]` `%`
 * lets the value break out of its option and inject arbitrary filter syntax
 * (at best a crashed render; at worst filter-graph abuse). Several services
 * built drawtext strings with weak or no escaping — these helpers are the one
 * place to do it correctly so they can't drift apart again.
 */

// Escape a string for safe interpolation inside drawtext `text='...'`.
// Mirrors the thorough escaping in videoRenderService.escapeFfmpegText.
function escapeDrawtext(text, maxLen = 200) {
  return String(text == null ? '' : text)
    .replace(/[\r\n]+/g, ' ') // newlines → space (drawtext treats \n literally)
    .replace(/\\/g, '\\\\') // backslash FIRST (everything below adds backslashes)
    .replace(/'/g, '’') // single quote → typographic quote (can't close the literal)
    .replace(/`/g, '\\`') // backtick (command-substitution guard)
    .replace(/;/g, '\\;') // semicolon (filter-graph separator)
    .replace(/,/g, '\\,') // comma (filter arg separator)
    .replace(/\[/g, '\\[') // brackets (filter-link labels)
    .replace(/\]/g, '\\]')
    .replace(/:/g, '\\:') // colon (option separator)
    .replace(/%/g, '\\%') // percent (drawtext format/strftime spec)
    .slice(0, maxLen);
}

// Whitelist a color to a safe ffmpeg token, falling back when it isn't one.
// Accepts: #rgb / #rrggbb / #rrggbbaa, 0xRRGGBB[@a], rgb()/rgba(), and named
// colors with an optional @alpha. Anything else (quotes, colons, exprs) → fallback.
function safeColor(css, fallback = 'white') {
  const s = String(css == null ? '' : css).trim();
  if (!s) return fallback;
  // rgb()/rgba() → 0xRRGGBB[@a]
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9]*\.?[0-9]+)\s*)?\)$/i);
  if (m) {
    const hex = [m[1], m[2], m[3]]
      .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, '0'))
      .join('');
    const a = m[4] !== undefined ? `@${Math.max(0, Math.min(1, parseFloat(m[4])))}` : '';
    return `0x${hex}${a}`;
  }
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s; // #hex
  if (/^0x[0-9a-fA-F]{6,8}(@[0-9]*\.?[0-9]+)?$/.test(s)) return s; // 0xhex[@a]
  if (/^[a-zA-Z]+(@[0-9]*\.?[0-9]+)?$/.test(s)) return s; // named[@a]
  return fallback;
}

// Sanitize a fontfile path for drawtext `fontfile='...'`: forward-slash the
// path and escape ffmpeg's colon, drop quotes/newlines. Returns '' for falsy
// input so callers can omit the option entirely.
function safeFontPath(p) {
  if (!p || typeof p !== 'string') return '';
  return p
    .replace(/[\r\n']/g, '')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:');
}

// Whitelist an ffmpeg position/numeric EXPRESSION (e.g. '(w-text_w)/2').
// Allows digits, letters (ffmpeg vars like w/h/text_w/t), arithmetic, parens
// and spaces only — rejects quotes/colons/commas that could break the option.
function safeExpr(expr, fallback = '0') {
  const s = String(expr == null ? '' : expr).trim();
  if (!s) return fallback;
  return /^[0-9a-zA-Z_+\-*/%(). ]+$/.test(s) ? s : fallback;
}

// Coerce to a finite number with a default + optional clamp — for numeric
// drawtext options (fontsize, borderw, times) so a string can't be injected.
function safeNum(v, def = 0, min = -1e9, max = 1e9) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, n));
}

module.exports = { escapeDrawtext, safeColor, safeFontPath, safeExpr, safeNum };
