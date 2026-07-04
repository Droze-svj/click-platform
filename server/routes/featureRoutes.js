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
];

/** Mount every feature route on the given Express app. */
function mountFeatureRoutes(app) {
  for (const [basePath, modulePath] of FEATURE_ROUTES) {
    app.use(basePath, require(modulePath));
  }
  return FEATURE_ROUTES.map(([p]) => p);
}

module.exports = mountFeatureRoutes;
module.exports.FEATURE_ROUTES = FEATURE_ROUTES;
