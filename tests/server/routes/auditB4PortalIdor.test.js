const fs = require('fs');
const path = require('path');
const rd = (rel) => fs.readFileSync(path.join(__dirname, '../../../server', rel), 'utf8');
describe('audit batch-4: portal IDOR', () => {
  it('portal-enhanced: activity routes use requirePortalAccess (not the no-op requireWorkspaceAccess)', () => {
    const s = rd('routes/portal-enhanced.js');
    expect(s).toMatch(/async function requirePortalAccess/);
    expect(s).toMatch(/WhiteLabelPortal\.findById\(req\.params\.portalId\)/);
    expect(s).toMatch(/'\/:portalId\/activity',\s*auth,\s*requirePortalAccess,/);
    expect(s).toMatch(/'\/:portalId\/activity\/:activityId\/read',\s*auth,\s*requirePortalAccess,/);
    expect(s).toMatch(/'\/:portalId\/activity\/read-all',\s*auth,\s*requirePortalAccess,/);
  });
  it('linkABTestingService.createABTest scopes both variants to the agency', () => {
    const s = rd('services/linkABTestingService.js');
    expect(s).not.toMatch(/BrandedLink\.findById\(variantA\)/);
    expect(s).toMatch(/BrandedLink\.findOne\(\{ _id: variantA, agencyWorkspaceId \}\)/);
    expect(s).toMatch(/BrandedLink\.findOne\(\{ _id: variantB, agencyWorkspaceId \}\)/);
  });
});
