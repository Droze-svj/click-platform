// Regression guard for client-health-enhanced cross-tenant IDOR (audit batch 3):
// per-client health routes took clientWorkspaceId/agencyWorkspaceId with only
// `auth` and read/wrote another tenant's health data. Now access-gated.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/client-health-enhanced.js'), 'utf8');
describe('client-health-enhanced IDOR guards', () => {
  it('agency+client routes use requireAgencyClientAccess', () => {
    expect(src).toMatch(/'\/:clientWorkspaceId\/health-alerts\/check',\s*auth,\s*requireAgencyClientAccess,/);
    expect(src).toMatch(/'\/:clientWorkspaceId\/key-wins\/detect',\s*auth,\s*requireAgencyClientAccess,/);
  });
  it('client-only routes use requireWorkspaceAccess()', () => {
    expect(src).toMatch(/'\/:clientWorkspaceId\/health-score\/forecast',\s*auth,\s*requireWorkspaceAccess\(\),/);
    expect(src).toMatch(/'\/:clientWorkspaceId\/health-alerts',\s*auth,\s*requireWorkspaceAccess\(\),/);
    expect(src).toMatch(/'\/:clientWorkspaceId\/health\/recommendations',\s*auth,\s*requireWorkspaceAccess\(\),/);
  });
});
