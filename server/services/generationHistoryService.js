// Cross-call generation history — server-side memory of what each user has
// already been shown, per generator kind, so repeat requests (a fresh session,
// "regenerate", or the same topic tomorrow) produce genuinely DIFFERENT output
// instead of the same hooks/captions/hashtags again.
//
// The generators already dedup against a CLIENT-supplied `exclude` list
// (utils/promptDedup) — but that only covers items the current client still
// remembers. This service persists the actual emitted text per (userId, kind)
// and hands it back as an additional exclude list on the next call, so dedup
// survives across requests, sessions, and devices.
//
// Backing: the shared redisCache (multi-instance, TTL'd) when Redis is
// connected; an in-memory LRU-ish Map fallback otherwise. Fully FAIL-OPEN — any
// error or a cold cache just means "no recalled excludes", never a thrown error
// and never a blocked generation.

const redisCache = require('../utils/redisCache');
const logger = require('../utils/logger');
const { dedupKey, itemText } = require('../utils/promptDedup');

const TTL_SECONDS = parseInt(process.env.GEN_HISTORY_TTL_SECONDS, 10) || 7 * 24 * 3600; // 7 days
const MAX_PER_KEY = parseInt(process.env.GEN_HISTORY_MAX, 10) || 60;

// In-memory fallback store. key -> { items: string[], at: epochMs }.
const mem = new Map();
const MEM_MAX_KEYS = 5000; // bound total memory when Redis is unavailable

function storeKey(userId, kind) {
  return `genhist:${String(userId)}:${String(kind)}`;
}

// Dedupe a list of candidate texts by normalized key, preserving the FIRST
// (most-recent) original text for each, capped to `max`.
function dedupeCap(texts, max) {
  const seen = new Set();
  const out = [];
  for (const t of texts) {
    const key = dedupKey(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(itemText(t)).trim());
    if (out.length >= max) break;
  }
  return out;
}

function memGet(k) {
  const entry = mem.get(k);
  if (!entry) return null;
  if (Date.now() - entry.at > TTL_SECONDS * 1000) { mem.delete(k); return null; }
  return entry.items;
}

function memSet(k, items) {
  if (mem.size >= MEM_MAX_KEYS && !mem.has(k)) {
    // Evict the oldest key to bound memory (cheap approximate LRU).
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(k, { items, at: Date.now() });
}

/**
 * Recent already-shown texts for this user+kind, newest first. Merge this into
 * the `exclude` list before generating. Never throws; returns [] on any miss.
 * @returns {Promise<string[]>}
 */
async function recentExclude(userId, kind, limit = 40) {
  if (!userId || !kind) return [];
  const k = storeKey(userId, kind);
  try {
    if (redisCache.isConnected) {
      const arr = await redisCache.get(k);
      return Array.isArray(arr) ? arr.slice(0, limit) : [];
    }
  } catch (err) {
    logger.debug('[genhist] recall failed', { error: err.message });
  }
  const items = memGet(k);
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

/**
 * Record the texts we just emitted so future calls dedup against them.
 * Best-effort — failures are swallowed (a repeat is better than a 500).
 */
async function recordOutputs(userId, kind, items) {
  if (!userId || !kind || !Array.isArray(items) || !items.length) return;
  const k = storeKey(userId, kind);
  const fresh = items.map((x) => String(itemText(x))).filter((s) => s.trim());
  if (!fresh.length) return;
  try {
    if (redisCache.isConnected) {
      const existing = (await redisCache.get(k)) || [];
      const merged = dedupeCap([...fresh, ...existing], MAX_PER_KEY);
      await redisCache.set(k, merged, TTL_SECONDS);
      return;
    }
  } catch (err) {
    logger.debug('[genhist] record failed', { error: err.message });
  }
  const existing = memGet(k) || [];
  memSet(k, dedupeCap([...fresh, ...existing], MAX_PER_KEY));
}

// Test-only: reset the in-memory store between cases.
function _resetMemory() { mem.clear(); }

module.exports = { recentExclude, recordOutputs, storeKey, MAX_PER_KEY, _resetMemory };
