// Regression guards for the Batch-3 pagination/array-clamp residuals
// (audit-b3-clamps). Ensures unbounded loops/fan-outs stay capped.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-3 clamp regressions', () => {
  test('#2 agency-bulk caps clientWorkspaceIds on every bulk route', () => {
    const src = read('server/routes/agency-bulk.js');
    expect(src).toMatch(/const MAX_BULK_CLIENTS = \d+/);
    // one guard per bulk route (clone-campaign, clone-content, customize-and-schedule)
    const guards = (src.match(/clientWorkspaceIds\.length > MAX_BULK_CLIENTS/g) || []).length;
    expect(guards).toBeGreaterThanOrEqual(3);
  });

  test('#3 agency-business forecast clamps months', () => {
    const src = read('server/routes/agency-business-enhanced.js');
    expect(src).toMatch(/clampInt\(req\.body\.months, 6, 36, 1\)/);
    expect(src).toMatch(/clampInt\(req\.body\.months, 3, 36, 1\)/);
  });

  test('#28 autopilot caps the items array', () => {
    const src = read('server/routes/autopilot.js');
    expect(src).toMatch(/items\.length > 200/);
  });
});
