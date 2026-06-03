/**
 * Safe JSON parsing utilities.
 *
 * Two intents, kept deliberately separate:
 *
 *  - parseRequestJson(value, fieldName) — for parsing UNTRUSTED user input
 *    (req.body / req.query / req.params fields that arrive as JSON strings).
 *    On malformed input it throws an Error tagged with `statusCode = 400` and
 *    a stable `code`, so the central error handler turns it into a clean 400
 *    "Invalid <field> JSON" instead of an unhandled 500.
 *
 *  - safeJsonParse(value, fallback) — for TRUSTED/INTERNAL data (cached
 *    strings, file contents, env vars, third-party payloads we don't want to
 *    fail hard on). Never throws; returns `fallback` when the value is empty
 *    or cannot be parsed.
 *
 * Note: AI/LLM output has its own purpose-built parser in utils/aiHelper.js
 * (markdown-fence stripping + brace repair). Use that for model output; use
 * these for plain JSON.
 */

/**
 * Parse a JSON string from user input. Throws a 400-tagged error on failure.
 * If `value` is already a non-string (object/array/number), it is returned
 * as-is — Express/body-parser often hands us pre-parsed objects.
 *
 * @param {*} value - the raw value to parse
 * @param {string} [fieldName='body'] - field name used in the error message
 * @returns {*} the parsed value
 */
function parseRequestJson(value, fieldName = 'body') {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value; // already parsed by body-parser
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    const e = new Error(`Invalid ${fieldName} JSON: ${err.message}`);
    e.statusCode = 400;
    e.code = 'INVALID_JSON';
    e.field = fieldName;
    throw e;
  }
}

/**
 * Parse a JSON string from a trusted/internal source. Never throws.
 *
 * @param {*} value - the raw value to parse
 * @param {*} [fallback=null] - returned when value is empty or unparseable
 * @returns {*} the parsed value, or `fallback`
 */
function safeJsonParse(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string') return value; // already an object/array
  const trimmed = value.trim();
  if (trimmed === '') return fallback;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return fallback;
  }
}

module.exports = { parseRequestJson, safeJsonParse };
