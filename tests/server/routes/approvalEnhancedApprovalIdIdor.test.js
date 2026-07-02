// Regression guard for approval-enhanced approvalId IDOR (audit batch 3):
// auto-advance/route/delegate mutated a ContentApproval by id with no scoping
// (empty-conditions rules auto-approve / reassign approver). Now requireApprovalAccess.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/approval-enhanced.js'), 'utf8');
describe('approval-enhanced approvalId IDOR guards', () => {
  it('defines requireApprovalAccess (creator/assignee/workspace)', () => {
    expect(src).toMatch(/async function requireApprovalAccess/);
    expect(src).toMatch(/ContentApproval\.findById\(req\.params\.approvalId\)/);
  });
  it('auto-advance / route / delegate use requireApprovalAccess', () => {
    expect(src).toMatch(/'\/:approvalId\/auto-advance',\s*auth,\s*requireApprovalAccess,/);
    expect(src).toMatch(/'\/:approvalId\/route',\s*auth,\s*requireApprovalAccess,/);
    expect(src).toMatch(/'\/:approvalId\/delegate',\s*auth,\s*requireApprovalAccess,/);
  });
});
