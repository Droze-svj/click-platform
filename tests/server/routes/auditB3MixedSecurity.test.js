// Regression guards for audit batch-3 mixed security fixes (all 3/3 confirmed).
const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes', p), 'utf8');

describe('audit batch-3 mixed security fixes', () => {
  it('auth.js: login SELECT fetches last_login_attempt_at (lockout no longer a no-op)', () => {
    const src = read('auth.js');
    expect(src).toMatch(/\.select\('id, email, first_name, last_name, password, login_attempts, last_login_attempt_at,/);
  });
  it('batch.js: /update sanitizes updates against SENSITIVE_FIELDS (no mass-assignment)', () => {
    const src = read('batch.js');
    expect(src).toMatch(/SENSITIVE_FIELDS/);
    expect(src).not.toMatch(/\$set: \{ \.\.\.updates, updatedAt/);
    expect(src).toMatch(/\$set: \{ \.\.\.safeUpdates, updatedAt/);
  });
  it('approvals.js: /workflows String()-casts teamId + verifies membership', () => {
    const src = read('approvals.js');
    expect(src).toMatch(/safeTeamId = String\(teamId\)/);
    expect(src).toMatch(/'members\.userId': req\.user\._id/);
    expect(src).not.toMatch(/getWorkflows\(req\.user\._id, teamId\)/);
  });
  it('ai-content.js: POST /templates checks canAccessTemplate (update) + verifyWorkspaceAccess (create)', () => {
    const src = read('ai-content.js');
    expect(src).toMatch(/if \(templateId\) \{[\s\S]*canAccessTemplate\(existing, req\)/);
    expect(src).toMatch(/verifyWorkspaceAccess\(req\.user\._id, agencyWorkspaceId\)/);
  });
});
