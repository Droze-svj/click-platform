// Guards the consolidated feature-route registry: every expected feature is
// mounted, each module resolves to a real Express router, and index.js uses the
// registry (so no feature silently drops off the mount list).

const fs = require('fs');
const path = require('path');
const mountFeatureRoutes = require('../../../server/routes/featureRoutes');

const EXPECTED = [
  '/api/calendar', '/api/first-comment', '/api/schedule', '/api/triage',
  '/api/streak', '/api/digest', '/api/repurpose', '/api/responder', '/api/series',
  '/api/hooks', '/api/hashtags', '/api/captions', '/api/critique', '/api/carousel',
];

describe('featureRoutes registry', () => {
  test('registers every expected feature, and no (path, module) pair twice', () => {
    const paths = mountFeatureRoutes.FEATURE_ROUTES.map(([p]) => p);
    for (const p of EXPECTED) expect(paths).toContain(p);

    // Several routers DO intentionally share a base path — the music-licensing
    // and ai-music clusters each split across multiple files, exactly as
    // server/index.js already stacks two routers on /api/music. So the invariant
    // is that no (basePath, module) PAIR repeats, not that each path is unique;
    // mounting the same module twice would run its middleware twice.
    const pairs = mountFeatureRoutes.FEATURE_ROUTES.map(([p, m]) => `${p} -> ${m}`);
    expect(new Set(pairs).size).toBe(pairs.length);

    // A module must not be mounted under two different bases either — that
    // would silently double every one of its endpoints.
    const modules = mountFeatureRoutes.FEATURE_ROUTES.map(([, m]) => m);
    expect(new Set(modules).size).toBe(modules.length);
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
