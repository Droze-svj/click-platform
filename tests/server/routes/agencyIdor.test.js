// Regression guard for agency.js cross-tenant IDOR (audit batch 3): client-scoped
// routes validated the agency (checkPermission) but not that the body
// clientWorkspaceId/clientId belongs to it; onboarding/step had no check at all.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/agency.js'), 'utf8');
describe('agency.js cross-tenant IDOR guards', () => {
  it('defines assertClientOfAgency via verifyClientWorkspaceAccess', () => {
    expect(src).toMatch(/async function assertClientOfAgency/);
    expect(src).toMatch(/verifyClientWorkspaceAccess\(agencyWorkspaceId, clientWorkspaceId\)/);
  });
  it('portals/bulk-import/reports-generate/billing-track verify client linkage', () => {
    const calls = (src.match(/assertClientOfAgency\(agencyWorkspaceId,/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(4);
  });
  it('onboarding/step gates on the owning agency (was unprotected)', () => {
    expect(src).toMatch(/ClientOnboarding\.findById\(onboardingId\)/);
    expect(src).toMatch(/checkPermission\(req\.user\._id, onboarding\.agencyWorkspaceId, 'canManageMembers'\)/);
  });
  it('reports/latest clamps the limit', () => {
    expect(src).toMatch(/const limit = clampInt\(req\.query\.limit, 10, 100, 1\)/);
  });
});
