// Regression guards for audit batch-3 medium fixes (all 3/3 confirmed).
const fs = require('fs');
const path = require('path');
const rd = (p) => fs.readFileSync(path.join(__dirname, '../../../server', p), 'utf8');
describe('audit batch-3 medium fixes', () => {
  it('benchmarking /alerts: userId spread last (no owner override)', () => {
    const s = rd('routes/benchmarking.js');
    expect(s).toMatch(/\.\.\.req\.body,\s*\n\s*userId: req\.user\._id/);
  });
  it('client-guidelines: workspaceId/agencyWorkspaceId spread last (no reassignment)', () => {
    const s = rd('routes/client-guidelines.js');
    expect(s).toMatch(/\.\.\.req\.body,\s*\n\s*workspaceId,\s*\n\s*agencyWorkspaceId/);
  });
  it('backup: multer has a fileSize limit', () => {
    expect(rd('routes/backup.js')).toMatch(/limits: \{ fileSize:/);
  });
  it('agentic status: getJobStatus is scoped to the caller (IDOR)', () => {
    expect(rd('routes/agentic.js')).toMatch(/getJobStatus\(req\.params\.jobId, req\.user\._id\)/);
    const svc = rd('services/agenticWorkflowService.js');
    expect(svc).toMatch(/async function getJobStatus\(jobId, userId/);
    expect(svc).toMatch(/AgenticJob\.findOne\(uid \? \{ jobId, userId: uid \}/);
  });
});
