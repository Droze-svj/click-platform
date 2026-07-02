// Regression guard for agency-bulk cross-tenant IDOR (audit batch 3): bulk routes
// verified the agency (URL) but not the body clientWorkspaceIds, so a caller could
// clone/schedule/import content into another tenant's client workspaces. Each now
// runs verifyClientsBelongToAgency (verifyClientWorkspaceAccess per id).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/agency-bulk.js'), 'utf8');
describe('agency-bulk cross-tenant IDOR guards', () => {
  it('defines verifyClientsBelongToAgency using verifyClientWorkspaceAccess', () => {
    expect(src).toMatch(/async function verifyClientsBelongToAgency/);
    expect(src).toMatch(/verifyClientWorkspaceAccess\(agencyWorkspaceId, clientWorkspaceId\)/);
  });
  it('clone-campaign / clone-content / customize-and-schedule / import all verify client linkage', () => {
    // 4 guarded routes (3 array + 1 single clientId)
    const calls = (src.match(/verifyClientsBelongToAgency\(agencyWorkspaceId,/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(4);
  });
});
