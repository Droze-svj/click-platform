// Guards the "route calls a service method with the wrong arguments" bug class.
//
// serviceExportContracts.test.js already catches a route calling a method that
// does not EXIST ("x is not a function"). This catches the quieter version: the
// method exists, the call compiles and runs, and the arguments land in the wrong
// parameters. JavaScript neither warns nor throws — extra arguments are dropped
// and missing ones become undefined — so the failure surfaces as a feature that
// does nothing, or does the wrong thing, with no error anywhere.
//
// The 2026-08 audit found three:
//
//   • youtubeService.uploadVideoToYouTube(userId, file, title, desc, options)
//     against (userId, videoPath, metadata) — `metadata` received the title
//     STRING, so every upload went out as "Untitled Sovereign Video".
//   • youtubeService.postToYouTube(userId, videoUrl, title, desc, options)
//     against (userId, postData) — postData received a string, every field
//     destructured to undefined, and the call fell through to the explicit
//     "text-only posts are not supported" throw. The endpoint could not succeed.
//   • pluginService.getAllPlugins(category) against () — the extra argument was
//     discarded, so GET /plugins?category=… accepted a filter and ignored it.
//
// Deliberately conservative: it only inspects calls made through an alias bound
// by a `require('.../services/x')` at the top of a route file, and only compares
// counts. That is enough to catch the class without guessing at types.

const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, '../../server');

// Known-good calls the counting rule cannot see through. Each needs a reason.
const ACCEPTED = new Set([
  // Every OAuth service's getAuthorizationUrl(userId, state, callbackUrl) carries
  // an explicit 2-argument compatibility shim — it detects the short form and
  // treats the second argument as the callback URL. The shim is commented at
  // each definition.
  'getAuthorizationUrl',
]);

/**
 * Remove block and line comments. Route files document their own wiring in
 * headers like "//   /thumbnail → aiThumbnailService.autoGenerateViralThumbnails",
 * which reads as a zero-argument call site to any regex that has not been told
 * otherwise. String contents are left alone; a service call inside a string
 * literal is not something this test needs to reason about.
 */
function stripComments(src) {
  return src
    // Keep the newlines a block comment spanned, so reported line numbers still
    // point at the real line in the file.
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir) {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Split a parameter or argument list on top-level commas. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** @returns {[number, number]} [minimum required, maximum accepted] */
function arityOf(params) {
  const parts = splitTopLevel(params);
  if (parts.length === 0) return [0, 0];
  const required = parts.filter((p) => !p.includes('=') && !p.startsWith('...')).length;
  const max = parts.some((p) => p.startsWith('...')) ? Infinity : parts.length;
  return [required, max];
}

/** Map every service module to { methodName: paramString }. */
function indexServices() {
  const services = {};
  for (const file of fs.readdirSync(path.join(SERVER, 'services'))) {
    if (!file.endsWith('.js')) continue;
    const src = fs.readFileSync(path.join(SERVER, 'services', file), 'utf8');
    const methods = {};
    // Class methods, at exactly two-space indentation.
    for (const m of src.matchAll(/^ {2}(?:async\s+)?([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm)) {
      const [, name, params] = m;
      if (['constructor', 'if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;
      methods[name] = params;
    }
    // Top-level function declarations.
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/gm)) {
      if (!(m[1] in methods)) methods[m[1]] = m[2];
    }
    services[file.replace(/\.js$/, '')] = methods;
  }
  return services;
}

/** Read the argument list of a call whose opening paren is at `openIdx`. */
function readArgs(src, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  let buf = '';
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) {
      depth--;
      if (depth === 0) break;
    }
    buf += ch;
    i++;
  }
  return depth === 0 ? splitTopLevel(buf) : null;
}

describe('routes call service methods with a valid number of arguments', () => {
  test('no route passes too many or too few arguments', () => {
    const services = indexServices();
    const offenders = [];

    for (const file of walk(path.join(SERVER, 'routes'))) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));

      const aliases = {};
      for (const m of src.matchAll(/const\s+(\w+)\s*=\s*require\('[^']*services\/(\w+)'\)/g)) {
        aliases[m[1]] = m[2];
      }
      if (Object.keys(aliases).length === 0) continue;

      for (const [alias, service] of Object.entries(aliases)) {
        const methods = services[service];
        if (!methods) continue;

        for (const m of src.matchAll(new RegExp(`\\b${alias}\\.(\\w+)\\s*\\(`, 'g'))) {
          const name = m[1];
          if (!(name in methods) || ACCEPTED.has(name)) continue;

          const args = readArgs(src, m.index + m[0].length - 1);
          if (args === null) continue;

          const [min, max] = arityOf(methods[name]);
          if (args.length > max || args.length < min) {
            const line = src.slice(0, m.index).split('\n').length;
            offenders.push(
              `${path.relative(SERVER, file)}:${line} ${alias}.${name}(${args.length} args) ` +
              `but ${service}.${name} takes ${min}${max === Infinity ? '+' : `..${max}`}`
            );
          }
        }
      }
    }

    // If this fails: the call and the definition disagree. Fix whichever is
    // wrong — passing extra arguments is not harmless, it means the ones you
    // meant to pass landed in the wrong parameters.
    expect(offenders).toEqual([]);
  });
});
