const fs = require('fs');
const path = require('path');
const rd = (p) => fs.readFileSync(path.join(__dirname, '../../../server/routes', p), 'utf8');
describe('audit batch-4: report-builder + phase16 IDOR', () => {
  it('report-builder POST /templates: verifyWorkspaceAccess on create + update', () => {
    const s = rd('report-builder.js');
    expect(s).toMatch(/if \(templateId\) \{[\s\S]*ReportTemplate\.findById\(templateId\)[\s\S]*verifyWorkspaceAccess\(req\.user\._id, existing\.agencyWorkspaceId\)/);
    expect(s).toMatch(/verifyWorkspaceAccess\(req\.user\._id, agencyWorkspaceId\)/);
  });
  it('phase16 remediation: contentId cast+validated and owner-scoped', () => {
    const s = rd('phase16_18.js');
    expect(s).toMatch(/const contentId = String\(req\.body\.contentId \|\| ''\)/);
    expect(s).toMatch(/mongoose\.Types\.ObjectId\.isValid\(contentId\)/);
    expect(s).toMatch(/Content\.findOne\(\{ _id: contentId, userId: \{ \$in: ids \} \}\)/);
  });
});
