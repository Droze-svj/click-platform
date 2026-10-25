// Cache middleware for API responses

const cacheService = require('../services/cacheService');

/**
 * Cache middleware that delegates to the robust Redis-backed cacheService.
 *
 * The key is USER-SCOPED: the global /api GET cache (server/index.js) caches per-user
 * responses (e.g. /music/browse, /me/*, /suggestions, /editor/presets), so a URL-only
 * key would serve user A's private data to user B. Scoping the key by the caller's id
 * (anonymous → a shared 'anon' bucket) makes that impossible.
 *
 * @param {number} ttl Time to live in seconds
 */
function cacheMiddleware(ttl = 300) { // 5 minutes default (in seconds for Redis)
  const cached = cacheService.cacheMiddleware(ttl, (req) => {
    const uid = (req.user && (req.user._id || req.user.id)) || 'anon';
    return `cache:u:${uid}:${req.originalUrl}:${JSON.stringify(req.query || {})}`;
  });
  return (req, res, next) => {
    // server/index.js mounts this on every /api GET BEFORE any route's auth
    // middleware runs, so req.user is never set there and every signed-in
    // request fell into the shared 'anon' bucket: user B was served user A's
    // cached /api/video list, an unauthenticated request got the same cached
    // body (a HIT returns before the route's auth check), and a user's own
    // polling (GET /content/:id/status) stayed "processing" for the whole TTL.
    // A request that carries credentials but hasn't been authenticated yet
    // can't be keyed to a user — never answer it from, or write it to, the cache.
    const credentialed = !!(req.headers && (req.headers.authorization || req.headers.cookie));
    const uid = req.user && (req.user._id || req.user.id);
    if (credentialed && !uid) return next();
    return cached(req, res, next);
  };
}

/**
 * Invalidate cache for specific patterns
 */
async function invalidateCache(pattern) {
  return cacheService.delPattern(pattern);
}

module.exports = {
  cacheMiddleware,
  invalidateCache
};







