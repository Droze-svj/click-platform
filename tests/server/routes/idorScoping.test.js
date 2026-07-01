// Regression guard for the IDOR fixes — these routes previously looked up a
// resource by a request-supplied id with NO ownership scope, letting one tenant
// read/modify/delete another's data. Lock the scoped lookups so they can't revert.

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes', p), 'utf8');

describe('IDOR scoping guards', () => {
  it('reports-enhanced: ReportTemplate lookups are workspace-scoped (no bare findById/findByIdAndDelete)', () => {
    const src = read('reports-enhanced.js');
    expect(src).not.toMatch(/ReportTemplate\.findById\(/);
    expect(src).not.toMatch(/ReportTemplate\.findByIdAndDelete\(/);
    // every ReportTemplate.findOne/findOneAndDelete must include agencyWorkspaceId
    const lookups = src.match(/ReportTemplate\.(findOne|findOneAndDelete)\([^)]*\)/g) || [];
    expect(lookups.length).toBeGreaterThanOrEqual(4);
    for (const l of lookups) expect(l).toContain('agencyWorkspaceId');
  });

  it('support-enhanced: the ticket-suggest route scopes SupportTicket by userId', () => {
    const src = read('support-enhanced.js');
    expect(src).not.toMatch(/SupportTicket\.findById\(/);
    expect(src).toMatch(/SupportTicket\.findOne\(\{\s*_id: ticketId,\s*userId: req\.user\._id/);
  });

  it('agency-bulk: the clone source Content lookup is tenant-scoped (no bare findById)', () => {
    const src = read('agency-bulk.js');
    expect(src).not.toMatch(/Content\.findById\(contentId\)/);
    const lookups = src.match(/Content\.findOne\(\{[\s\S]*?_id: contentId[\s\S]*?\}\)/g) || [];
    expect(lookups.length).toBeGreaterThanOrEqual(2);
    for (const l of lookups) {
      expect(l).toContain('agencyWorkspaceId');
      expect(l).toContain('req.user._id');
    }
  });

  it('portal-enhanced: LinkGroup by-id lookups are workspace-scoped (no bare findById)', () => {
    const src = read('portal-enhanced.js');
    // requireWorkspaceAccess only validates the URL workspace, not the child
    // resource — these must scope by agencyWorkspaceId or the group escapes tenant.
    expect(src).not.toMatch(/LinkGroup\.findById\(/);
    const lookups = src.match(/LinkGroup\.findOne\(\{[\s\S]*?_id: groupId[\s\S]*?\}\)/g) || [];
    expect(lookups.length).toBeGreaterThanOrEqual(2);
    for (const l of lookups) expect(l).toContain('agencyWorkspaceId');
  });

  it('branded-links: BrandedLink by-id read/update/delete are workspace-scoped (no bare findById*)', () => {
    const src = read('branded-links.js');
    expect(src).not.toMatch(/BrandedLink\.findById\(/);
    expect(src).not.toMatch(/BrandedLink\.findByIdAndDelete\(/);
    // GET + analytics-ownership + PUT + DELETE = 4 scoped lookups, all by workspace.
    const lookups = src.match(/BrandedLink\.(findOne|findOneAndDelete)\(\{[\s\S]*?_id: linkId[\s\S]*?\}\)/g) || [];
    expect(lookups.length).toBeGreaterThanOrEqual(4);
    for (const l of lookups) expect(l).toContain('agencyWorkspaceId');
  });
});
