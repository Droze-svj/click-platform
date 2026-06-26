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
  return cacheService.cacheMiddleware(ttl, (req) => {
    const uid = (req.user && (req.user._id || req.user.id)) || 'anon';
    return `cache:u:${uid}:${req.originalUrl}:${JSON.stringify(req.query || {})}`;
  });
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







