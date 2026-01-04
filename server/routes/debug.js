// Debug relay routes (local dev only)
//
// Purpose: allow the Next.js frontend to send debug events to the local ingest server
// without browser CORS issues, by proxying through the backend (same-origin via /api rewrite).
//
// Never log secrets (tokens, cookies, PII).

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

function appendLocalLog(obj) {
  // Never throw; this must not impact app behavior.
  try {
    const p = path.join(process.cwd(), 'logs', 'agent_debug.ndjson');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8');
  } catch {}

  // Best-effort mirror to the historical Cursor debug file path.
  // Note: the IDE/tooling may block deletion of this file, but writing can still work.
  try {
    const p = path.join(process.cwd(), '.cursor', 'debug.log');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8');
  } catch {}
}

router.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

router.post('/log', async (req, res) => {
  try {

    // Fire-and-forget relay; never block the client on logging.
    try {
      appendLocalLog(req.body || {});
    } catch {}
  } catch {
    // swallow
  }
  res.status(204).end();
});

module.exports = router;


