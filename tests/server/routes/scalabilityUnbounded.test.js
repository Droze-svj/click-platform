// Regression guards for the scalability unbounded-query fixes.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('scalability: unbounded query bounding', () => {
  test('alertSweep iterates users via a per-label keyset cursor, not find().limit(all)', () => {
    const src = read('server/services/alertSweepCronService.js');
    expect(src).toMatch(/const sweepCursors = \{\}/);
    // Keyset pagination (_id > cursor) in bounded pages.
    expect(src).toMatch(/\{ _id: \{ \$gt: after \} \}/);
    expect(src).toMatch(/\.limit\(pageSize\)/);
    // The old materialize-all pattern is gone.
    expect(src).not.toMatch(/User\.find\(\{\}\)\.select\('_id'\)\.limit\(MAX_USERS_PER_SWEEP\)/);
  });

  test('/api/recurring list is paginated', () => {
    const src = read('server/routes/recurring.js');
    const route = src.slice(src.indexOf("router.get('/', auth"));
    expect(route).toMatch(/clampInt\(req\.query\.limit/);
    expect(route).toMatch(/\.limit\(limit\)/);
  });

  test('/api/music-licensing/playlists is paginated', () => {
    const src = read('server/routes/music-licensing-favorites.js');
    const route = src.slice(src.indexOf("router.get('/playlists'"));
    expect(route).toMatch(/clampInt\(req\.query\.limit/);
    expect(route).toMatch(/\.limit\(limit\)/);
    expect(route).toMatch(/\.skip\(skip\)/);
  });
});
