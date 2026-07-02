// Regression guards for the Batch-3 IDOR/authz residuals (audit-b3-idor-authz).
// Source-level assertions that each previously-unscoped route now runs an
// ownership/authz guard before its service call.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-3 IDOR/authz regressions', () => {
  test('#39 competitor sync verifies workspace access before syncing', () => {
    const src = read('server/routes/client-health-enhanced.js');
    const route = src.slice(src.indexOf("router.post('/:competitorId/sync'"));
    expect(route).toMatch(/CompetitorMonitoring\.findById/);
    expect(route).toMatch(/verifyWorkspaceAccess\(req\.user\._id, competitor\.workspaceId\)/);
  });

  test('#43 sync-all is admin-gated', () => {
    const src = read('server/routes/client-health-enhanced.js');
    expect(src).toMatch(/router\.post\('\/sync-all', auth, requireAdmin/);
  });

  test('#44 sentiment route is scoped to the post owner', () => {
    const src = read('server/routes/client-health.js');
    expect(src).toMatch(/function requirePostOwner/);
    expect(src).toMatch(/router\.post\('\/:postId\/comments\/sentiment', auth, requirePostOwner/);
  });

  test('#23 multi-step approval verifies workspace + content ownership', () => {
    const src = read('server/routes/approval-workflow.js');
    const route = src.slice(src.indexOf("router.post('/multi-step'"));
    expect(route).toMatch(/verifyWorkspaceAccess\(req\.user\._id, workspaceId\)/);
    expect(route).toMatch(/Content\.exists\(\{ _id: String\(contentId\), workspaceId \}\)/);
  });

  test('#15/#16 approval-enhanced version + comment routes are owner-guarded', () => {
    const src = read('server/routes/approval-enhanced.js');
    expect(src).toMatch(/function requirePostOwner/);
    expect(src).toMatch(/function requireEntityOwner/);
    expect(src).toMatch(/comments\/rich', auth, requirePostOwner/);
    expect(src).toMatch(/reaction', auth, requirePostOwner/);
    expect(src).toMatch(/visual-diff', auth, requireEntityOwner/);
    expect(src).toMatch(/annotations', auth, requireEntityOwner/);
  });
});
