// Route-mount coverage: every top-level server/routes/*.js must be either mounted
// in server/index.js OR explicitly listed as KNOWN_DEAD. This catches the silent
// failure mode where a new feature's route file is added but never mounted (calls
// 404 in prod), and keeps the dead-code set documented + from growing.

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../../server/routes');
const indexSrc = fs.readFileSync(path.join(__dirname, '../../server/index.js'), 'utf8');
// Creator-feature routes are mounted via the featureRoutes registry (referenced
// as './<name>'), not directly in index.js — scan it too so they count as mounted.
const featureRoutesSrc = fs.readFileSync(path.join(ROUTES_DIR, 'featureRoutes.js'), 'utf8');

// Intentionally NOT mounted (dead / superseded duplicates / experimental). Adding a
// new route file? Mount it in server/index.js, or add it here ON PURPOSE.
//   - ai-content        → superseded by routes/ai/content-generation (mounted)
//   - music-*           → the whole family is unmounted (confirmed in the security audit)
//   - creative/ai-enhanced/videoSharing/automation-analytics/admin-new
// (hookEnsemble, music-catalog, music-catalog-sync, music-editing,
//  music-ai-suggestions were DELETED in the dead-code purge — pruned from here.)
const KNOWN_DEAD = new Set([
  'ai-content', 'ai-enhanced', 'ai-music-admin', 'ai-music-analytics',
  'ai-music-batch', 'ai-music-generation', 'ai-music-recommendations', 'ai-music-templates',
  'creative',
  'music-catalog-playlists', 'music-dynamic-generation', 'music-learning',
  'music-licensing-admin', 'music-licensing-analytics', 'music-licensing-compliance',
  'music-licensing-favorites', 'music-licensing-tools',
  'music-licensing-transparency', 'music-licensing', 'music-smart-sync',
  // digitalTwin, retention-heatmap, trust, toolbox, dubbing were REVIVED (Phase F)
  // — mounted because the frontend already calls them; verified by the smoke sweep.
  //
  // creatorDna, dmca, remix, style-vault (+ routes/api/brand) were REVIVED in the
  // production-readiness pass. dmca is the notable one: client/app/legal/dmca/
  // page.tsx has been POSTing to /api/dmca/notice all along and getting a 404.
  // style-vault and api/brand were unmountable until their fake auth was replaced
  // with the real middleware (style-vault hardcoded req.user = 'test_user_v6';
  // api/brand had no auth and fell back to a shared 'mock-user-123' bucket).
  //
  // STILL DEAD, deliberately — these are duplicates, not unshipped features:
  //   admin-new           → same route paths as the mounted admin.js; one would
  //                         silently shadow the other. Reconcile, don't mount.
  //   videoSharing        → GET /accounts is a hardcoded placeholder AND collides
  //                         with the real GET /api/social/accounts in social.js.
  //   automation-analytics→ 0-byte file; require() yields {} (see featureRoutes
  //                         mount guard). Nothing to mount yet.
  //   music-licensing     → 0-byte file, same as above.
  'admin-new', 'automation-analytics', 'videoSharing',
]);

const isMounted = (name) =>
  indexSrc.includes(`routes/${name}'`) || indexSrc.includes(`routes/${name}"`) ||
  featureRoutesSrc.includes(`'./${name}'`) || featureRoutesSrc.includes(`"./${name}"`);

const topLevelRoutes = fs.readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.js'))
  // Ignore iCloud/Finder duplicate artifacts ("foo 2.js") — the project lives in
  // an iCloud Drive folder which can create these locally; they're untracked junk,
  // not real routes.
  .filter((f) => !/\s\d+\.js$/.test(f) && !/\scopy/i.test(f))
  .map((f) => f.replace(/\.js$/, ''));

describe('route mount coverage', () => {
  test('every top-level route file is mounted OR explicitly KNOWN_DEAD', () => {
    const unexpectedlyDead = topLevelRoutes.filter((f) => !isMounted(f) && !KNOWN_DEAD.has(f));
    // If this fails: mount the route in server/index.js, or add it to KNOWN_DEAD on purpose.
    expect(unexpectedlyDead).toEqual([]);
  });

  test('KNOWN_DEAD has no stale entries (route got mounted → prune it)', () => {
    const nowMounted = [...KNOWN_DEAD].filter((f) => isMounted(f));
    expect(nowMounted).toEqual([]);
  });
});

// The video/ sub-routers are mounted EITHER directly in server/index.js
// (app.use('/api/video/x', require('./routes/video/x'))) OR inside the parent
// routes/video.js aggregator (router.use('/x', require('./video/x'))). The
// original coverage test only scanned top-level routes/*.js, which is exactly
// how POST /api/video/hook-analysis/auto-caption shipped unmounted (a 404 that
// silently broke the editor's "Add captions" button + Auto Viral Edit). This
// block closes that gap.
const VIDEO_DIR = path.join(ROUTES_DIR, 'video');
const videoParentSrc = fs.readFileSync(path.join(ROUTES_DIR, 'video.js'), 'utf8');

// The unmounted experimental scenes*/openshorts route files were DELETED in the
// dead-code purge. Any NEW unmounted video/ route file must be mounted or added
// here on purpose.
const VIDEO_KNOWN_DEAD = new Set([]);

const isVideoMounted = (name) =>
  indexSrc.includes(`video/${name}'`) || indexSrc.includes(`video/${name}"`) ||
  videoParentSrc.includes(`./video/${name}'`) || videoParentSrc.includes(`./video/${name}"`);

const videoRoutes = fs.readdirSync(VIDEO_DIR)
  .filter((f) => f.endsWith('.js'))
  .filter((f) => !/\s\d+\.js$/.test(f) && !/\scopy/i.test(f))
  .map((f) => f.replace(/\.js$/, ''));

describe('video/ sub-router mount coverage', () => {
  test('every routes/video/*.js is mounted OR explicitly VIDEO_KNOWN_DEAD', () => {
    const unexpectedlyDead = videoRoutes.filter((f) => !isVideoMounted(f) && !VIDEO_KNOWN_DEAD.has(f));
    // If this fails: mount it in server/index.js (or routes/video.js), or add it
    // to VIDEO_KNOWN_DEAD on purpose.
    expect(unexpectedlyDead).toEqual([]);
  });

  test('hook-analysis (auto-caption) stays mounted — regression guard', () => {
    expect(isVideoMounted('hook-analysis')).toBe(true);
  });

  test('VIDEO_KNOWN_DEAD has no stale entries (got mounted → prune it)', () => {
    const nowMounted = [...VIDEO_KNOWN_DEAD].filter((f) => isVideoMounted(f));
    expect(nowMounted).toEqual([]);
  });
});
