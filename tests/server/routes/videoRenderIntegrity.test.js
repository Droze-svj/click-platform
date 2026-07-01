// Regression guard for video/render.js audit fixes (batch 1):
//  - c2pa persistAuthenticity upserts AuditMetadata by contentId alone, so a
//    client tree.metadata.contentId could overwrite another tenant's provenance;
//    both render routes now strip an unowned contentId first.
//  - /render-multi was missing renderLimiter (render rate-limit bypass).

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../../server/routes/video/render.js'), 'utf8');

describe('video/render.js integrity guards', () => {
  it('/render-multi is behind renderLimiter (no render rate-limit bypass)', () => {
    expect(/'\/render-multi',\s*\n\s*auth,\s*\n\s*renderLimiter,/.test(src)).toBe(true);
  });

  it('an unowned tree.metadata.contentId is stripped before c2pa persistence', () => {
    expect(/async function stripUnownedContentId\(tree, req\)/.test(src)).toBe(true);
    expect(/Content\.findOne\(\{ _id: cid, userId: \{ \$in: ids \} \}\)/.test(src)).toBe(true);
    // both render routes call it
    expect((src.match(/await stripUnownedContentId\(tree, req\)/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
