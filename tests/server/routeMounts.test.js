// Route-mount coverage: every top-level server/routes/*.js must be either mounted
// in server/index.js OR explicitly listed as KNOWN_DEAD. This catches the silent
// failure mode where a new feature's route file is added but never mounted (calls
// 404 in prod), and keeps the dead-code set documented + from growing.

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '../../server/routes');
const indexSrc = fs.readFileSync(path.join(__dirname, '../../server/index.js'), 'utf8');

// Intentionally NOT mounted (dead / superseded duplicates / experimental). Adding a
// new route file? Mount it in server/index.js, or add it here ON PURPOSE.
//   - ai-content        → superseded by routes/ai/content-generation (mounted)
//   - music-*           → the whole family is unmounted (confirmed in the security audit)
//   - creatorDna/digitalTwin/hookEnsemble/dubbing/creative/ai-enhanced/toolbox/trust/
//     style-vault/remix/videoSharing/retention-heatmap/automation-analytics/admin-new/dmca
const KNOWN_DEAD = new Set([
  'admin-new', 'ai-content', 'ai-enhanced', 'ai-music-admin', 'ai-music-analytics',
  'ai-music-batch', 'ai-music-generation', 'ai-music-recommendations', 'ai-music-templates',
  'automation-analytics', 'creative', 'creatorDna', 'digitalTwin', 'dmca', 'dubbing',
  'hookEnsemble', 'music-ai-suggestions', 'music-catalog-playlists', 'music-catalog-sync',
  'music-catalog', 'music-dynamic-generation', 'music-editing', 'music-learning',
  'music-licensing-admin', 'music-licensing-analytics', 'music-licensing-compliance',
  'music-licensing-favorites', 'music-licensing-sync', 'music-licensing-tools',
  'music-licensing-transparency', 'music-licensing', 'music-smart-sync', 'remix',
  'retention-heatmap', 'style-vault', 'toolbox', 'trust', 'videoSharing',
]);

const isMounted = (name) =>
  indexSrc.includes(`routes/${name}'`) || indexSrc.includes(`routes/${name}"`);

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
