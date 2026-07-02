// Regression guard for content-insights postId IDOR (audit batch 3). The metrics/
// prediction/heatmap/quality services fetch a ScheduledPost by id with no owner
// filter — any authed user could read/overwrite another tenant's post insights.
// Each :postId route now runs requirePostOwner (scoped ScheduledPost lookup).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes', p), 'utf8');

const guarded = (src, routeRe) => expect(src).toMatch(routeRe);

describe('content-insights postId IDOR guards', () => {
  it('content-insights.js: postId routes use requirePostOwner + limit clamped', () => {
    const src = read('content-insights.js');
    expect(src).toMatch(/async function requirePostOwner/);
    expect(src).toMatch(/ScheduledPost\.findOne\(\{ _id: req\.params\.postId, userId: \{ \$in: ids \} \}\)/);
    guarded(src, /'\/:postId\/content-performance\/update',\s*auth,\s*requirePostOwner,/);
    guarded(src, /'\/:postId\/video-metrics',\s*auth,\s*requirePostOwner,/);
    guarded(src, /'\/:postId\/video-metrics\/retention',\s*auth,\s*requirePostOwner,/);
    expect(src).toMatch(/limit: clampInt\(limit, 10, 100, 1\)/);
  });

  it('content-insights-enhanced.js: all 5 postId routes use requirePostOwner', () => {
    const src = read('content-insights-enhanced.js');
    expect(src).toMatch(/async function requirePostOwner/);
    for (const re of [
      /'\/:postId\/predict',\s*auth,\s*requirePostOwner,/,
      /'\/:postId\/predictions\/update-actual',\s*auth,\s*requirePostOwner,/,
      /post\('\/:postId\/video-heatmap',\s*auth,\s*requirePostOwner,/,
      /get\('\/:postId\/video-heatmap',\s*auth,\s*requirePostOwner,/,
      /'\/:postId\/quality\/score',\s*auth,\s*requirePostOwner,/,
    ]) guarded(src, re);
  });
});
