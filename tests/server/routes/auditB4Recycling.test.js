const fs=require('fs');const path=require('path');
const rd=(p)=>fs.readFileSync(path.join(__dirname,'../../../server',p),'utf8');
describe('audit batch-4 recycling IDOR', () => {
  it('recycling-advanced: freshness + predict assert content ownership; auto-winner passes owner ids', () => {
    const s=rd('routes/recycling-advanced.js');
    expect(s).toMatch(/async function assertOwnsContent/);
    expect(s).toMatch(/Content\.exists\(\{ _id: String\(contentId\), userId: \{ \$in: ids \} \}\)/);
    expect((s.match(/assertOwnsContent\(/g)||[]).length).toBeGreaterThanOrEqual(3); // def + freshness + predict
    expect(s).toMatch(/autoSelectWinner\(testId, variantResults, options, ownerIdsOf\(req\)\)/);
  });
  it('abVariantService.autoSelectWinner: deploy write is owner-scoped', () => {
    const s=rd('services/abVariantService.js');
    expect(s).not.toMatch(/Content\.findByIdAndUpdate\(winner\.contentId/);
    expect(s).toMatch(/Content\.findOneAndUpdate\(\s*\{ _id: winner\.contentId, userId: \{ \$in: ownerIds \} \}/);
  });
  it('repostAlertService.createRepostAlert: recycleId ownership verified', () => {
    const s=rd('services/repostAlertService.js');
    expect(s).toMatch(/ContentRecycle\.exists\(\{ _id: alertData\.recycleId, userId \}\)/);
  });
});
