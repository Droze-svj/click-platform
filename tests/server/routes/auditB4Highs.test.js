const fs=require('fs');const path=require('path');const rd=(p)=>fs.readFileSync(path.join(__dirname,'../../../server/routes',p),'utf8');
describe('audit batch-4 highs', () => {
  it('pricing respond: verifies ticket ownership before responding', () => {
    const s=rd('pricing-enhanced.js');
    expect(s).toMatch(/const existing = await getTicket\(ticketId\)/);
    expect(s).toMatch(/existing\.userId\.toString\(\) !== req\.user\._id\.toString\(\) && req\.user\.role !== 'admin'/);
  });
  it('pipeline /variations: count is clamped', () => {
    const s=rd('pipeline.js');
    expect(s).toMatch(/const count = clampInt\(req\.body\.count, 3, 5, 1\)/);
  });
});
