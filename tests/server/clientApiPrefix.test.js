// Guards against the "double /api prefix" bug class.
//
// The client API helper (client/lib/api.ts) is configured with baseURL '/api',
// so every apiGet/apiPost/apiPut/apiDelete/apiPatch call must pass a path
// WITHOUT a leading '/api' — e.g. apiPost('/autopilot'), NOT apiPost('/api/autopilot').
// A leading '/api' double-prefixes to '/api/api/...', which the Next rewrite
// proxies to http://backend/api/api/... → a silent 404 that breaks the feature
// with no error (audit of 2026-06 found 16 such calls across 9 dashboard pages:
// autopilot, approvals, agency capacity, the SEO suite, trends repurpose, hook
// A/B, auto-clip).
//
// NOTE: native fetch('/api/...') calls are CORRECT (no baseURL) and are not
// matched here — only the api* helpers are.

const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, '../../client');

function walk(dir) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (/node_modules|\.next|\bdist\b|\bcoverage\b/.test(p)) continue;
      out = out.concat(walk(p));
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

// api*( [generics] ( whitespace/newlines ) 'quote' <path> 'quote'
const CALL_RE = /\bapi(?:Get|Post|Put|Delete|Patch)\s*(?:<[^>]*>)?\s*\(\s*([`'"])((?:\\.|(?!\1).)*)\1/g;

const files = walk(CLIENT_DIR).filter((f) => {
  // skip the helper's own JSDoc examples, iCloud/Finder dup artifacts ("x 2.ts"),
  // legacy *.old.* files, and the dead client/views/ duplicate tree.
  if (/[/\\]lib[/\\]api\.ts$/.test(f)) return false;
  if (/\s\d+\.(ts|tsx)$/.test(f) || /\.old\.(ts|tsx)$/.test(f)) return false;
  if (/[/\\]views[/\\]video-editor[/\\]/.test(f)) return false; // unused duplicate of components/editor/views
  return true;
});

describe('client API helpers never double-prefix with /api', () => {
  test('no apiGet/apiPost/... call passes a path starting with /api/', () => {
    const offenders = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      let m;
      CALL_RE.lastIndex = 0;
      while ((m = CALL_RE.exec(src))) {
        const p = m[2];
        if (p.startsWith('/api/') || p === '/api') {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(`${path.relative(CLIENT_DIR, f)}:${line} → ${p}`);
        }
      }
    }
    // If this fails: drop the leading '/api' from the path (baseURL already adds it).
    expect(offenders).toEqual([]);
  });
});
