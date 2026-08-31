// Guards the "Mongoose silently drops the field" bug class.
//
// Mongoose schemas are strict by default: a path the schema does not declare is
// discarded on save, with no error and no warning. So `new Content({ body })`
// looks like it works, returns a saved document, and the body is simply not
// there. Nothing in the endpoint sweeps can see it — the request succeeds.
//
// The 2026-08 audit found 24 such sites. What they cost:
//
//   • POST /api/content/:id/duplicate set status:'draft', which is not in the
//     Content status enum, so it 400'd for EVERY item — the feature had never
//     worked. It also copied `text` and `folder` (the path is `folderId`).
//   • Content.content.text was read by seven live routes (first-comment,
//     carousel-composer, caption-angles, repurpose-studio, hook-generator,
//     caption-critique, hashtag-strategist) and written by eight, but declared
//     by neither — so every reader always fell through to its fallback.
//   • Workflow.definition was dropped on create, and executeWorkflow then did
//     `const { nodes, edges } = workflow.definition` — a TypeError on undefined.
//   • The schedule_post workflow action wrote `scheduledFor`; the required path
//     is `scheduledTime`, so the action threw every time.
//   • Six services recorded provenance in ScheduledPost.metadata, undeclared,
//     so the "which agent/bulk run produced this post" trail was lost.
//
// The check: for every `new Model({...})` / `Model.create({...})` in the server,
// compare the literal's top-level keys against the model's real schema paths,
// read from Mongoose itself rather than parsed out of the model file.

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const SERVER = path.join(__dirname, '../../server');
const SCANNED = ['services', 'routes', 'workers', 'jobs'];

// Mongoose supplies these regardless of the schema.
const IMPLICIT = new Set(['_id', '__v', 'id', 'createdAt', 'updatedAt']);

// Keys that are deliberately passed but not persisted. Each needs a reason.
const ACCEPTED = new Map([]);

function loadAllModels() {
  for (const file of fs.readdirSync(path.join(SERVER, 'models'))) {
    if (!file.endsWith('.js')) continue;
    try { require(path.join(SERVER, 'models', file)); } catch { /* optional deps */ }
  }
  const out = {};
  for (const name of mongoose.modelNames()) {
    const schema = mongoose.model(name).schema;
    out[name] = {
      // Top-level segment only: declaring `content` covers `content.text`.
      top: new Set(Object.keys(schema.paths).map((p) => p.split('.')[0])),
      strict: schema.options.strict !== false,
    };
  }
  return out;
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

/** Blank out comments, keeping newlines so line numbers stay true. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Top-level keys of an object literal body. */
function topLevelKeys(body) {
  const keys = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if ('{[('.includes(ch)) depth++;
    else if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      cur = '';
    } else {
      cur += ch;
      if (depth === 0 && ch === ':') {
        const k = cur.slice(0, -1).trim().replace(/^['"]|['"]$/g, '');
        if (/^[A-Za-z_]\w*$/.test(k)) keys.push(k);
        cur = '';
      }
    }
  }
  return keys;
}

/** Body of the object literal whose `{` is at openIdx, or null if unbalanced. */
function literalBody(src, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(openIdx + 1, i);
    }
  }
  return null;
}

describe('no write targets a path the schema will drop', () => {
  test('every Model.create/new Model literal uses declared paths', () => {
    const models = loadAllModels();
    expect(Object.keys(models).length).toBeGreaterThan(100); // models really loaded

    const offenders = [];
    const files = SCANNED
      .map((d) => path.join(SERVER, d))
      .filter((d) => fs.existsSync(d))
      .flatMap((d) => walk(d));

    for (const file of files) {
      const src = stripComments(fs.readFileSync(file, 'utf8'));
      const re = /\b([A-Z]\w+)\.create\(\s*\{|\bnew\s+([A-Z]\w+)\(\s*\{/g;
      let m;
      while ((m = re.exec(src))) {
        const modelName = m[1] || m[2];
        const info = models[modelName];
        // Not a model, or the schema accepts anything.
        if (!info || !info.strict) continue;

        const body = literalBody(src, m.index + m[0].length - 1);
        if (body === null) continue;

        const dropped = topLevelKeys(body).filter(
          (k) => !info.top.has(k) && !IMPLICIT.has(k) && !ACCEPTED.has(`${modelName}.${k}`)
        );
        if (dropped.length > 0) {
          const line = src.slice(0, m.index).split('\n').length;
          offenders.push(
            `${path.relative(SERVER, file)}:${line} ${modelName} ← dropped: ${dropped.join(', ')}`
          );
        }
      }
    }

    // If this fails: the listed keys will NOT be saved. Either use the path the
    // schema actually declares, declare the path on the model, or — if the key
    // is deliberately transient — add `Model.key` to ACCEPTED with the reason.
    expect(offenders).toEqual([]);
  });
});
