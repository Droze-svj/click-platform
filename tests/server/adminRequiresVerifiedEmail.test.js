// Admin is granted by email allowlist. Unverified accounts can sign in (and
// production can't send verification email), so the first person to register
// an allowlisted address became admin. A verified email is now required.

const { requireAdmin } = require('../../server/middleware/admin');

function run(user) {
  return new Promise((resolve) => {
    const res = { status(c) { this.code = c; return this; }, json() { resolve(this.code); return this; } };
    requireAdmin({ user }, res, () => resolve(200));
  });
}

describe('requireAdmin', () => {
  const saved = process.env.ADMIN_EMAILS;
  beforeAll(() => { process.env.ADMIN_EMAILS = 'owner@example.com'; });
  afterAll(() => { if (saved === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = saved; });

  it('lets in the allowlisted owner with a verified email', async () => {
    expect(await run({ email: 'Owner@example.com', emailVerified: true })).toBe(200);
  });
  it('refuses the same address when it is not verified', async () => {
    expect(await run({ email: 'owner@example.com', emailVerified: false })).toBe(403);
  });
  it('refuses a verified address that is not allowlisted', async () => {
    expect(await run({ email: 'someone@example.com', emailVerified: true })).toBe(403);
  });
});
