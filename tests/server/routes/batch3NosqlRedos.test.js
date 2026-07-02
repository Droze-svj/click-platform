// Regression guards for the Batch-3 NoSQL-injection + ReDoS residuals
// (audit-b3-nosql-redos). Source-level assertions that user-supplied filter
// values are String()-cast and the template search is escaped + scope-preserving.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-3 NoSQL/ReDoS regressions', () => {
  test('#4 businessAlertService casts severity/type', () => {
    const src = read('server/services/businessAlertService.js');
    expect(src).toMatch(/query\['alert\.severity'\] = String\(severity\)/);
    expect(src).toMatch(/query\['alert\.type'\] = String\(type\)/);
  });

  test('#5 campaignCPAService casts platform/type', () => {
    const src = read('server/services/campaignCPAService.js');
    expect(src).toMatch(/query\['campaign\.platform'\] = String\(platform\)/);
    expect(src).toMatch(/query\['campaign\.type'\] = String\(campaignType\)/);
  });

  test('#26 advancedAudienceInsightsService casts platform', () => {
    const src = read('server/services/advancedAudienceInsightsService.js');
    expect(src).toMatch(/query\.platform = String\(platform\)/);
  });

  test('#46/#45 keyWinService casts filters and clamps limit', () => {
    const src = read('server/services/keyWinService.js');
    expect(src).toMatch(/query\['win\.type'\] = String\(type\)/);
    expect(src).toMatch(/query\['win\.impact'\] = String\(impact\)/);
    expect(src).toMatch(/\.limit\(clampInt\(limit, 20, 500, 1\)\)/);
  });

  test('#47 comments route casts entityId in read and create', () => {
    const src = read('server/routes/comments.js');
    expect(src).toMatch(/Comment\.find\(\{ teamId, entityId: String\(entityId\) \}\)/);
    expect(src).toMatch(/entityId: String\(entityId\),/);
  });

  test('#17 comment-templates search is escaped and preserves workspace scope', () => {
    const src = read('server/services/richCommentService.js');
    expect(src).toMatch(/escapeRegex\(String\(search\)\)/);
    // Uses $and (not a $or reassignment) so the workspace/isPublic scope survives.
    expect(src).toMatch(/query\.\$and = \[\{/);
  });
});
