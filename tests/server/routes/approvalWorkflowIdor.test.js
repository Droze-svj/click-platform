// Regression guard for approval-workflow collaboration IDOR (audit batch 3):
// comment/resolve/revision routes mutated a ContentApproval by id with no scoping.
// Now gated by requireApprovalAccess (creator / assignee / workspace member).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/approval-workflow.js'), 'utf8');
describe('approval-workflow collaboration IDOR guards', () => {
  it('defines requireApprovalAccess (creator/assignee/workspace)', () => {
    expect(src).toMatch(/async function requireApprovalAccess/);
    expect(src).toMatch(/verifyWorkspaceAccess\(req\.user\._id, approval\.workspaceId\)/);
  });
  it('comments/resolve/revisions routes use requireApprovalAccess', () => {
    expect(src).toMatch(/'\/:approvalId\/comments',\s*auth,\s*requireApprovalAccess,/);
    expect(src).toMatch(/'\/:approvalId\/comments\/:commentId\/resolve',\s*auth,\s*requireApprovalAccess,/);
    expect(src).toMatch(/'\/:approvalId\/revisions',\s*auth,\s*requireApprovalAccess,/);
  });
});
