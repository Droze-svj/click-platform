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
    // `objectIdOrSkip('approvalId')` may sit ahead of `auth` on these routes —
    // it declines non-ObjectId segments so static paths in the other routers
    // mounted on /api/approvals stay reachable (see tests/server/routeShadowing).
    // It is a matcher, not an authorization step, so what this test cares about
    // is unchanged: requireApprovalAccess must still follow auth.
    const guard = String.raw`(?:objectIdOrSkip\('approvalId'\),\s*)?`;
    expect(src).toMatch(new RegExp(String.raw`'\/:approvalId\/comments',\s*${guard}auth,\s*requireApprovalAccess,`));
    expect(src).toMatch(new RegExp(String.raw`'\/:approvalId\/comments\/:commentId\/resolve',\s*${guard}auth,\s*requireApprovalAccess,`));
    expect(src).toMatch(new RegExp(String.raw`'\/:approvalId\/revisions',\s*${guard}auth,\s*requireApprovalAccess,`));
  });
});
