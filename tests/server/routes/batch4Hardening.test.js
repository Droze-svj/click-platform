// Regression guards for the Batch-4 hardening fixes (audit-b4-hardening).
// Source-level assertions so a future refactor can't silently reintroduce the
// exact defects the audit closed. Each block documents the original bug.

const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-4 hardening regressions', () => {
  test('push /subscribe SSRF-guards the client-supplied endpoint', () => {
    const src = read('server/routes/push.js');
    expect(src).toMatch(/require\(['"]\.\.\/utils\/urlGuard['"]\)/);
    // The guard must run inside /subscribe before the endpoint is stored/sent.
    const subscribe = src.slice(src.indexOf("router.post('/subscribe'"));
    expect(subscribe).toMatch(/assertPublicUrl\(subscription\.endpoint\)/);
  });

  test('phase13_15 keys fleet services by the canonical ObjectId (_id)', () => {
    const src = read('server/routes/phase13_15.js');
    // FleetNode.userId is an ObjectId; passing the Supabase UUID (req.user.id)
    // CastErrors → 500. All three handlers must use req.user._id.
    expect(src).not.toMatch(/req\.user\.id\b/);
    expect(src).toMatch(/calibrateFleet\(req\.user\._id\)/);
    expect(src).toMatch(/getClusterStabilityIndex\(req\.user\._id\)/);
    expect(src).toMatch(/deploySovereignManifest\(req\.user\._id,/);
  });

  test('pipeline /batch caps the contentIds fan-out', () => {
    const src = read('server/routes/pipeline.js');
    const batch = src.slice(src.indexOf("router.post('/batch'"));
    expect(batch).toMatch(/contentIds\.length > 25/);
  });

  test('playbookService no longer updates stats.clientsUsed in two operators', () => {
    const src = read('server/services/playbookService.js');
    const apply = src.slice(src.indexOf('async function applyPlaybookToClient'));
    const update = apply.slice(apply.indexOf('findByIdAndUpdate'), apply.indexOf('return {'));
    // Mongo rejects the same path in $inc and $set ("would create a conflict"),
    // which made every /apply call 500. The update must not carry a $set at all
    // (both counters move via $inc), so clientsUsed can never collide.
    expect(update).not.toMatch(/\$set/);
    expect(update).toMatch(/\$inc/);
    expect(update).toMatch(/'stats\.clientsUsed':\s*1/);
  });

  test('recurring validates the caller-supplied timezone before use', () => {
    const src = read('server/routes/recurring.js');
    expect(src).toMatch(/function isValidTimezone/);
    // Applied on both create (POST) and update (PUT).
    expect((src.match(/isValidTimezone\(cadence\.timezone\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
