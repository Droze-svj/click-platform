// Guards the consolidated feature-route registry: every expected feature is
// mounted, each module resolves to a real Express router, and index.js uses the
// registry (so no feature silently drops off the mount list).

const fs = require('fs');
const path = require('path');
const mountFeatureRoutes = require('../../../server/routes/featureRoutes');

const EXPECTED = [
  '/api/calendar', '/api/first-comment', '/api/schedule', '/api/triage',
  '/api/streak', '/api/digest', '/api/repurpose', '/api/responder', '/api/series',
  '/api/hooks', '/api/hashtags',
];

describe('featureRoutes registry', () => {
  test('registers every expected feature path exactly once', () => {
    const paths = mountFeatureRoutes.FEATURE_ROUTES.map(([p]) => p);
    for (const p of EXPECTED) expect(paths).toContain(p);
    expect(new Set(paths).size).toBe(paths.length); // no dupes
  });

  test('every referenced route module loads as an Express router', () => {
    for (const [, modPath] of mountFeatureRoutes.FEATURE_ROUTES) {
      // Resolve relative to the routes dir (where featureRoutes.js requires from).
      const mod = require(path.join(__dirname, '../../../server/routes', modPath));
      expect(typeof mod).toBe('function');   // an Express router is a function
      expect(Array.isArray(mod.stack)).toBe(true); // ...with a middleware stack
    }
  });

  test('mountFeatureRoutes calls app.use once per registered feature and returns the paths', () => {
    // Compare against the registry itself (self-maintaining as features are added).
    const registryPaths = mountFeatureRoutes.FEATURE_ROUTES.map(([p]) => p);
    const calls = [];
    const fakeApp = { use: (p) => calls.push(p) };
    const returned = mountFeatureRoutes(fakeApp);
    expect(calls.sort()).toEqual([...registryPaths].sort());
    expect(returned.sort()).toEqual([...registryPaths].sort());
  });

  test('index.js delegates to the registry (no stray individual feature mounts)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../../server/index.js'), 'utf8');
    expect(src).toMatch(/require\('\.\/routes\/featureRoutes'\)\(app\)/);
    // The old inline mounts must be gone (would defeat the consolidation).
    expect(src).not.toMatch(/app\.use\('\/api\/calendar', require\('\.\/routes\/calendar-autofill'\)\)/);
  });
});
