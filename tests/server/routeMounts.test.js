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
//   - creatorDna/digitalTwin/hookEnsemble/dubbing/creative/ai-enhanced/toolbox/trust/
//     style-vault/remix/videoSharing/retention-heatmap/automation-analytics/admin-new/dmca
const KNOWN_DEAD = new Set([
  'admin-new', 'ai-content', 'ai-enhanced', 'ai-music-admin', 'ai-music-analytics',
  'ai-music-batch', 'ai-music-generation', 'ai-music-recommendations', 'ai-music-templates',
  'automation-analytics', 'creative', 'creatorDna', 'dmca',
  'hookEnsemble', 'music-ai-suggestions', 'music-catalog-playlists', 'music-catalog-sync',
  'music-catalog', 'music-dynamic-generation', 'music-editing', 'music-learning',
  'music-licensing-admin', 'music-licensing-analytics', 'music-licensing-compliance',
  'music-licensing-favorites', 'music-licensing-sync', 'music-licensing-tools',
  'music-licensing-transparency', 'music-licensing', 'music-smart-sync', 'remix',
  'style-vault', 'videoSharing',
  // digitalTwin, retention-heatmap, trust, toolbox, dubbing were REVIVED (Phase F)
  // — mounted because the frontend already calls them; verified by the smoke sweep.
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

// Genuinely unmounted experimental files (an in-progress "scenes" pipeline +
// openshorts), confirmed not referenced anywhere in server/. Wire one up? Mount
// it and prune it from here.
const VIDEO_KNOWN_DEAD = new Set([
  'openshorts', 'scenes',
  'scenes-advanced', 'scenes-analytics', 'scenes-audio-change-points',
  'scenes-audio-features', 'scenes-audio-visualization', 'scenes-editing',
  'scenes-job', 'scenes-quality', 'scenes-settings', 'scenes-shot-clustering',
  'scenes-visual-audio-fusion', 'scenes-workflow',
]);

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
