// escapeHtml — escape a value for interpolation into HTML (emails, the few
// server-rendered pages). User text is stored exactly as typed, so every HTML
// output must escape at the point of output.
//
// Text saved before 2026-10-24 was HTML-escaped on the way IN by the global
// input sanitizer (`Tom&#x27;s`). Those entities are decoded first so legacy
// rows don't come out double-escaped (`Tom&amp;#x27;s`).

const { unescape: decodeEntities } = require('validator');

function escapeHtml(value) {
  if (value == null) return '';
  return decodeEntities(String(value))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Plain text → HTML: escaped, with line breaks kept. */
function textToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

module.exports = { escapeHtml, textToHtml };
