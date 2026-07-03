// Regression guards for the Batch-2 analytics identity residuals
// (audit-b2-analytics-identity). Both were empty-result correctness bugs.

const fs = require('fs');
const path = require('path');
const read = (rel) => fs.readFileSync(path.join(__dirname, '../../../', rel), 'utf8');

describe('Batch-2 analytics identity regressions', () => {
  test('BI content aggregates String()-cast userId (Content.userId is a String)', () => {
    const src = read('server/services/businessIntelligenceService.js');
    const byType = src.slice(src.indexOf('function getContentByType'), src.indexOf('function getContentByStatus'));
    const byStatus = src.slice(src.indexOf('function getContentByStatus'), src.indexOf('function getScheduledPosts'));
    expect(byType).toMatch(/userId: String\(userId\)/);
    expect(byStatus).toMatch(/userId: String\(userId\)/);
    // The un-cast form (which silently matched nothing in aggregate) is gone.
    expect(byType).not.toMatch(/userId: userId,/);
    expect(byStatus).not.toMatch(/userId: userId,/);
  });

  test('analytics /dashboard keys Supabase queries by the UUID (req.user.id)', () => {
    const src = read('server/routes/analytics/core.js');
    const dash = src.slice(src.indexOf("router.get('/dashboard'"));
    // Prefer req.user.id (Supabase author_id is a UUID), not the Mongo ObjectId.
    expect(dash).toMatch(/const userId = req\.user\.id \|\| req\.user\._id;/);
  });
});
