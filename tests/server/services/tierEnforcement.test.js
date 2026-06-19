const { evaluateTierLimit } = require('../../../server/middleware/tierEnforcement');

const plan = {
  bundle: {
    clients: { included: 10, overageRate: 0 },
    profiles: { included: 25, overageRate: 2 }, // pay-as-you-go overage
    aiMinutes: { included: 500, overageRate: 0.1 },
  },
  limits: { teamMembers: 5, apiCalls: 10000 },
};

describe('evaluateTierLimit', () => {
  it('allows under the limit, with remaining count', () => {
    const r = evaluateTierLimit('add_client', plan, 7);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it('BLOCKS at the limit when no overage (→ 402 upstream)', () => {
    const r = evaluateTierLimit('add_client', plan, 10);
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/limit reached/i);
    expect(r.upgrade).toBeTruthy();
  });

  it('allows with an overage flag when overageRate>0', () => {
    const r = evaluateTierLimit('add_profile', plan, 25);
    expect(r.allowed).toBe(true);
    expect(r.overage).toBe(true);
    expect(r.overageRate).toBe(2);
  });

  it('add_team_member uses limits.teamMembers', () => {
    expect(evaluateTierLimit('add_team_member', plan, 4).allowed).toBe(true);
    expect(evaluateTierLimit('add_team_member', plan, 5).allowed).toBe(false);
  });

  it('no plan or unknown action → allowed (never block when unconfigured)', () => {
    expect(evaluateTierLimit('add_client', null, 100).allowed).toBe(true);
    expect(evaluateTierLimit('mystery_action', plan, 100).unlimited).toBe(true);
  });
});
