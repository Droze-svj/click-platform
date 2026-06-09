// Regression test for the requireRole privilege-escalation fix.
// Before the fix, requireRole(['admin']) called next() for EVERY authenticated
// user (fail-open). These tests lock in fail-CLOSED behavior.

const { requireRole } = require('../../../server/middleware/roleAuth');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('requireRole', () => {
  it('blocks a non-admin user from an admin-only route (fail closed)', () => {
    const mw = requireRole('admin');
    const res = mockRes();
    let nextCalled = false;
    mw({ user: { role: 'free' } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('blocks a paid (non-admin) user from an admin-only route', () => {
    const mw = requireRole(['admin']);
    const res = mockRes();
    let nextCalled = false;
    mw({ user: { subscription: { tier: 'agency' } } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('allows an admin user', () => {
    const mw = requireRole('admin');
    const res = mockRes();
    let nextCalled = false;
    mw({ user: { role: 'admin' } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBeNull();
  });

  it('allows a user whose role is explicitly in the required set', () => {
    const mw = requireRole(['editor', 'free']);
    const res = mockRes();
    let nextCalled = false;
    mw({ user: { role: 'editor' } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('admin can access any role-gated route (override)', () => {
    const mw = requireRole(['editor']);
    const res = mockRes();
    let nextCalled = false;
    mw({ user: { role: 'admin' } }, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('401s when unauthenticated', () => {
    const mw = requireRole('admin');
    const res = mockRes();
    let nextCalled = false;
    mw({}, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });
});
