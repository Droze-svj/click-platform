/**
 * What may leave the server in an error report or a log line.
 *
 * Sentry is a third party, and Render keeps our logs, so neither gets
 * request bodies, cookies, auth headers, query strings (signed-media
 * signatures and OAuth codes live there), IP addresses, emails, or the text
 * of a user's content as it goes to and from the AI providers. An error
 * report carries the error, the route, the device type and the account id.
 */

// Key names whose values are secrets. Whole-word forms for the short ones so
// statusCode, author or signupSource are left alone.
const SECRET_KEY = /^(code|sig|otp|auth|pin)$|password|passwd|passphrase|token|secret|api[-_]?key|authori[sz]ation|cookie|signature|totp|credential|recovery|backup[-_]?codes?|session[-_]?id/i;

// Request headers worth keeping; everything else is dropped.
const SAFE_HEADERS = new Set([
  'user-agent', 'content-type', 'content-length', 'accept', 'accept-language', 'x-request-id',
]);

// Span/trace attributes that carry prompt or completion text.
const AI_TEXT_ATTR = /^gen_ai\.(request\.messages|response\.text|prompt|completion|input\.messages|output\.messages|system_instructions|tool\.(input|output))/;

const MAX_DEPTH = 6;
const MAX_STRING = 500;

function stripQuery(url) {
  if (typeof url !== 'string') return url;
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

/** Drops the query from every URL or path inside free text ("GET /a?sig=x" → "GET /a"). */
function stripQueriesInText(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/((?:https?:\/\/[^\s/?#]+)?\/[^\s?#]*)[?#]\S*/g, '$1');
}

/** Copy of `v` with secret-looking keys replaced and long strings cut. */
function redactForLog(v, depth = 0) {
  if (v == null) return v;
  if (typeof v === 'string') return v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…[${v.length} chars]` : v;
  if (typeof v !== 'object') return v;
  if (depth >= MAX_DEPTH) return '[…]';
  if (Buffer.isBuffer(v)) return `[Buffer ${v.length}]`;
  if (v instanceof Date) return v;
  if (Array.isArray(v)) {
    const head = v.slice(0, 20).map((x) => redactForLog(x, depth + 1));
    return v.length > 20 ? [...head, `…[${v.length - 20} more]`] : head;
  }
  const out = {};
  for (const [k, x] of Object.entries(v)) {
    out[k] = SECRET_KEY.test(k) ? '[REDACTED]' : redactForLog(x, depth + 1);
  }
  return out;
}

function scrubAttributes(data) {
  if (!data || typeof data !== 'object') return data;
  for (const k of Object.keys(data)) {
    if (AI_TEXT_ATTR.test(k)) {
      delete data[k];
    } else if (/(^|\.)(url|target|query)$|^http\.(url|target|query)|^url\.(full|query)$/.test(k)) {
      if (/query$/.test(k)) delete data[k];
      else data[k] = stripQuery(data[k]);
    } else if (typeof data[k] === 'string' && SECRET_KEY.test(k.split('.').pop())) {
      data[k] = '[REDACTED]';
    }
  }
  return data;
}

function scrubRequest(request) {
  if (!request) return request;
  delete request.cookies;
  delete request.data;
  delete request.query_string;
  delete request.env;
  if (request.url) request.url = stripQuery(request.url);
  if (request.headers && typeof request.headers === 'object') {
    const kept = {};
    for (const [k, v] of Object.entries(request.headers)) {
      if (SAFE_HEADERS.has(k.toLowerCase())) kept[k] = v;
    }
    request.headers = kept;
  }
  return request;
}

/** Sentry beforeSend / beforeSendTransaction. Mutates and returns the event. */
function scrubEvent(event) {
  if (!event || typeof event !== 'object') return event;
  try {
    if (event.request) scrubRequest(event.request);
    if (event.user) {
      const id = event.user.id;
      event.user = id ? { id: String(id) } : undefined;
      if (!event.user) delete event.user;
    }
    if (event.extra) event.extra = redactForLog(event.extra);
    if (event.contexts) {
      if (event.contexts.trace) scrubAttributes(event.contexts.trace.data);
      // Node attaches the process environment's culture/runtime only; drop anything ad hoc.
      for (const [name, ctx] of Object.entries(event.contexts)) {
        if (!['trace', 'os', 'runtime', 'app', 'device', 'culture', 'cloud_resource', 'response'].includes(name)) {
          event.contexts[name] = redactForLog(ctx);
        }
      }
    }
    if (event.transaction) event.transaction = stripQueriesInText(event.transaction);
    if (Array.isArray(event.spans)) {
      for (const span of event.spans) {
        scrubAttributes(span.data);
        if (span.description) span.description = stripQueriesInText(span.description);
      }
    }
    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb).filter(Boolean);
    }
  } catch (_) {
    // A report we can't clean is a report we don't send.
    return null;
  }
  return event;
}

/** Sentry beforeBreadcrumb. */
function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb;
  if (crumb.data) {
    const data = { ...crumb.data };
    scrubAttributes(data);
    crumb.data = redactForLog(data);
  }
  if (typeof crumb.message === 'string') crumb.message = stripQueriesInText(crumb.message);
  return crumb;
}

module.exports = { scrubEvent, scrubBreadcrumb, redactForLog, stripQuery, stripQueriesInText };
