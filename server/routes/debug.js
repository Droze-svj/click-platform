// Debug relay routes (local dev only)
//
// Purpose: allow the Next.js frontend to send debug events to the local ingest server
// without browser CORS issues, by proxying through the backend (same-origin via /api rewrite).
//
// POST /log and GET /log are handled here to avoid Next.js "Response body disturbed or locked"
// errors that occur when the client aborts or when Next.js caches POST requests.
//
// Never log secrets (tokens, cookies, PII).

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// In-memory logs (last 1000) for GET /log - matches Next.js route behavior
const MAX_MEMORY_LOGS = 1000;
let memoryLogs = [];

function appendLocalLog(obj) {
  // Never throw; this must not impact app behavior.
  try {
    const p = path.join(process.cwd(), 'logs', 'agent_debug.ndjson');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8');
  } catch { }

  try {
    const p = path.join(process.cwd(), '.cursor', 'debug.log');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(obj) + '\n', 'utf8');
  } catch { }
}

function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const k of Object.keys(out)) {
    const key = String(k).toLowerCase();
    if (key.includes('token') || key.includes('password') || key.includes('authorization') ||
      key.includes('cookie') || key.includes('apikey') || key.includes('api_key')) {
      out[k] = '[REDACTED]';
    } else if (k === 'data' && out[k] && typeof out[k] === 'object') {
      out[k] = redact(out[k]);
    }
  }
  return out;
}

router.get('/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

router.get('/log', (req, res) => {
  try {
    res.json({
      logs: memoryLogs.slice(-50),
      total: memoryLogs.length,
      timestamp: Date.now()
    });
  } catch {
    res.json({ logs: [], total: 0, timestamp: Date.now() });
  }
});

router.delete('/log', (req, res) => {
  try {
    memoryLogs = [];
    res.json({ success: true, message: 'Logs cleared successfully', timestamp: Date.now() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post('/log', async (req, res) => {
  res.status(204).end(); // Respond immediately so client never blocks
  try {
    const body = req.body || {};
    const safe = redact(body);
    if (safe.component || safe.message || safe.data) {
      memoryLogs.push({
        timestamp: Date.now(),
        component: safe.component,
        message: safe.message,
        data: safe.data
      });
      if (memoryLogs.length > MAX_MEMORY_LOGS) {
        memoryLogs = memoryLogs.slice(-MAX_MEMORY_LOGS);
      }
    }
    appendLocalLog(body);
  } catch { /* swallow */ }
});

module.exports = router;


