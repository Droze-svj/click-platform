// Regression guards for Batch-2 workflow IDOR + SCIM pagination residuals
// (audit-b2-workflow-idor).

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-2 workflow IDOR + SCIM regressions', () => {
  test('advanced-automation :workflowId routes are owner-guarded', () => {
    const src = read('server/routes/workflows/advanced-automation.js');
    expect(src).toMatch(/async function requireWorkflowOwner/);
    expect(src).toMatch(/Workflow\.exists\(\{ _id: req\.params\.workflowId, userId: getUserIdFromReq\(req\) \}\)/);
    // Applied to execute, history, analytics.
    expect(src).toMatch(/\/:workflowId\/execute', authenticate, requireWorkflowOwner/);
    expect(src).toMatch(/\/:workflowId\/history', authenticate, requireWorkflowOwner/);
    expect(src).toMatch(/\/:workflowId\/analytics', authenticate, requireWorkflowOwner/);
  });

  test('SCIM /Users clamps count and startIndex', () => {
    const src = read('server/routes/sso/scim.js');
    expect(src).toMatch(/count: clampInt\(count, 100, 1000, 1\)/);
    expect(src).toMatch(/startIndex: clampInt\(startIndex, 1,/);
  });
});
