// Distributed cron lock — keeps autonomous workers safe when the app
// runs on >1 replica (Render auto-scaling, blue/green, k8s rolling).
//
// Strategy: use Redis SETNX with TTL when Redis is configured; fall back
// to a per-process in-memory flag when it isn't. The in-memory mode is
// the same correctness contract as before — it only prevents double-runs
// inside ONE process. The Redis mode prevents cross-replica double-runs
// too.
//
// Each cron declares a name; the lock TTL should be longer than the
// expected cron-runtime so the next replica's tick can't grab the lock
// mid-execution. If a cron exceeds its TTL the lock auto-expires and
// the next tick will (correctly) start a fresh run.
//
// Also exposes `autonomousModeEnabled()` — a single env-var gate so the
// user can disable every cron at once (DISABLE_CRONS=true). Useful for
// debug, for testing without polluting analytics, and for emergency
// "stop everything" during incidents.

const logger = require('./logger');

let redisClient = null;
let redisAttempted = false;
const memoryLocks = new Map(); // name → expiresAtMs

function getRedis() {
  if (redisAttempted) return redisClient;
  redisAttempted = true;
  try {
    const url = process.env.REDIS_URL;
    if (!url || url.includes('placeholder')) return null;
    const redis = require('redis');
    const client = redis.createClient({
      url,
      socket: { connectTimeout: 2000, reconnectStrategy: (retries) => (retries > 2 ? false : 500) },
    });
    client.on('error', (err) => logger.warn('cronLock: Redis error', { error: err.message }));
    client.connect().catch((err) => {
      logger.warn('cronLock: Redis connect failed, falling back to in-process locks', { error: err.message });
      redisClient = null;
    });
    redisClient = client;
    return client;
  } catch (err) {
    logger.warn('cronLock: Redis module unavailable, using in-process locks', { error: err.message });
    return null;
  }
}

/**
 * Try to acquire a lock named `name` for at most `ttlMs` milliseconds.
 * Returns a release function on success, or null if the lock is held.
 *
 * Usage:
 *   const release = await acquire('tokenRefresh', 5 * 60 * 1000);
 *   if (!release) return; // someone else is running
 *   try { ... } finally { await release(); }
 */
async function acquire(name, ttlMs) {
  const ttl = Math.max(1000, Math.floor(ttlMs));
  const r = getRedis();
  const key = `click:cron:lock:${name}`;
  if (r && r.isReady) {
    try {
      // SET NX PX — atomic acquire with auto-expiry. Owner-token lets us
      // release safely without deleting someone else's lock if our TTL
      // expired and another worker grabbed it.
      const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const result = await r.set(key, token, { NX: true, PX: ttl });
      if (result === 'OK') {
        return async () => {
          // Lua compare-and-delete so we only release a lock we still own.
          try {
            const lua = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
            await r.eval(lua, { keys: [key], arguments: [token] });
          } catch (err) {
            logger.warn('cronLock: release failed', { name, error: err.message });
          }
        };
      }
      return null;
    } catch (err) {
      logger.warn('cronLock: Redis acquire failed, falling back to memory', { name, error: err.message });
      // Fall through to memory path below.
    }
  }

  // In-process fallback. Same contract as before, but with explicit TTL
  // so a hung cron doesn't permanently block the next tick.
  const now = Date.now();
  const existing = memoryLocks.get(name);
  if (existing && existing > now) return null;
  memoryLocks.set(name, now + ttl);
  return async () => { memoryLocks.delete(name); };
}

/**
 * Read the master autonomous-mode toggle. When DISABLE_CRONS=true (or
 * AUTONOMOUS_MODE=off), every cron should bail out of its tick. The user
 * can flip this at boot to take all background workers offline without
 * tearing down the server.
 */
function autonomousModeEnabled() {
  const disabled = String(process.env.DISABLE_CRONS || '').toLowerCase() === 'true'
    || String(process.env.AUTONOMOUS_MODE || '').toLowerCase() === 'off';
  return !disabled;
}

module.exports = { acquire, autonomousModeEnabled };
