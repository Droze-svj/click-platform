// Feature route registry
// Single place to mount the creator-feature endpoints added in the 2026 feature
// batch. index.js calls mountFeatureRoutes(app) ONCE — so adding a new feature
// route means one line here, not an edit to index.js (which used to cause a merge
// conflict on every feature PR).

// [ basePath, module path ] — order is irrelevant (each route auths per-handler).
const FEATURE_ROUTES = [
  ['/api/calendar', './calendar-autofill'],      // Content Calendar Autofill
  ['/api/first-comment', './first-comment'],     // First-Comment Generator
  ['/api/schedule', './schedule-optimal'],       // Optimal-Time Auto-Schedule
  ['/api/triage', './comment-triage'],           // Comment Triage
  ['/api/streak', './streak'],                   // Posting Streak
  ['/api/digest', './digest'],                   // Weekly Performance Digest
  ['/api/repurpose', './repurpose-studio'],      // Smart Repurpose Studio
  ['/api/responder', './social-responder'],      // AI Comment/DM Responder
  ['/api/series', './content-series'],           // Content Series Planner
  ['/api/hooks', './hook-generator'],            // Hook Generator
  ['/api/hashtags', './hashtag-strategist'],     // Hashtag Strategist
  ['/api/captions', './caption-angles'],         // Caption Angles
  ['/api/critique', './caption-critique'],       // Caption Critique
  ['/api/carousel', './carousel-composer'],      // Carousel / Thread Composer
  ['/api/dmca', './dmca'],                       // DMCA notice / counter-notice intake
  ['/api/me/creator-dna', './creatorDna'],       // Read-only Creator DNA
  ['/api/remix', './remix'],                     // Remix Hub (discover + clone)
  ['/api/style-vault', './style-vault'],         // NLE timeline → StyleProfile
  ['/api/brand', './api/brand'],                 // Brand Style DNA profiles

  // ── Music licensing ────────────────────────────────────────────────────────
  // Order matters: the two SPECIFIC prefixes go first. Both -admin and
  // -analytics define `GET /providers`, so they cannot share a base with each
  // other — sub-prefixes disambiguate them (/admin/providers vs
  // /analytics/providers). The remaining files already namespace their own
  // paths (/dynamic/*, /learning/*, /sync/*, /transparency*, /favorites*,
  // /compare, /quota, ...) so they coexist on one base.
  ['/api/music-licensing/admin', './music-licensing-admin'],
  ['/api/music-licensing/analytics', './music-licensing-analytics'],
  ['/api/music-licensing', './music-licensing-compliance'],
  ['/api/music-licensing', './music-licensing-favorites'],
  ['/api/music-licensing', './music-licensing-tools'],
  ['/api/music-licensing', './music-licensing-transparency'],
  ['/api/music-licensing', './music-dynamic-generation'],
  ['/api/music-licensing', './music-learning'],
  ['/api/music-licensing', './music-smart-sync'],
  // Curated catalog playlists get their OWN base: this file and
  // music-licensing-favorites both define /playlists*, and on a shared base one
  // would permanently shadow the other.
  ['/api/music-catalog', './music-catalog-playlists'],

  // ── AI music generation ────────────────────────────────────────────────────
  // Same shape: -admin and -generation both define `GET /providers`.
  ['/api/ai-music/admin', './ai-music-admin'],
  ['/api/ai-music/analytics', './ai-music-analytics'],
  ['/api/ai-music', './ai-music-generation'],
  ['/api/ai-music', './ai-music-batch'],
  ['/api/ai-music', './ai-music-recommendations'],
  ['/api/ai-music', './ai-music-templates'],
];

/**
 * Mount every feature route on the given Express app.
 *
 * Each module is validated before mounting: `app.use(path, {})` throws a bare
 * "requires a middleware function" TypeError at boot that names no file, and a
 * couple of route files in this tree have been committed as 0-byte stubs (a
 * `require` of one yields `{}`). Failing here instead names the offender.
 */
function mountFeatureRoutes(app) {
  for (const [basePath, modulePath] of FEATURE_ROUTES) {
    const mod = require(modulePath);
    if (typeof mod !== 'function') {
      throw new Error(
        `[featureRoutes] ${modulePath} does not export an Express router ` +
        `(got ${mod === null ? 'null' : typeof mod}${
          mod && typeof mod === 'object' && Object.keys(mod).length === 0 ? ' — empty object, is the file blank?' : ''
        }). Cannot mount ${basePath}.`
      );
    }
    app.use(basePath, mod);
  }
  return FEATURE_ROUTES.map(([p]) => p);
}

module.exports = mountFeatureRoutes;
module.exports.FEATURE_ROUTES = FEATURE_ROUTES;
