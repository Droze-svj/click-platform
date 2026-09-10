const fs=require('fs');const path=require('path');const rd=(p)=>fs.readFileSync(path.join(__dirname,'../../../server/routes',p),'utf8');
describe('audit batch-4 highs', () => {
  it('pricing respond: verifies ticket ownership before responding', () => {
    const s=rd('pricing-enhanced.js');
    // The guard must fetch the ticket first and compare its owner to the caller,
    // with only an admin escape. Matched structurally rather than as one literal
    // expression: the handler legitimately reads the caller id through the
    // getUserId(req) helper (req.user._id ?? req.user.id), and pinning the old
    // `req.user._id.toString()` spelling failed that refactor while the guard
    // itself was intact. Deleting the check still fails all three assertions.
    expect(s).toMatch(/const existing = await getTicket\(ticketId\)/);
    const respond = s.slice(s.indexOf("router.post('/support/tickets/:ticketId/respond'"));
    const body = respond.slice(0, respond.indexOf('}));') + 4);
    expect(body).toMatch(/existing\.userId\.toString\(\)\s*!==\s*(String\(getUserId\(req\)\)|req\.user\.?\??\._id\.toString\(\))/);
    expect(body).toMatch(/req\.user\.?\??\.role\s*!==\s*'admin'/);
  });
  it('pipeline /variations: count is clamped', () => {
    const s=rd('pipeline.js');
    expect(s).toMatch(/const count = clampInt\(req\.body\.count, 3, 5, 1\)/);
  });
});
