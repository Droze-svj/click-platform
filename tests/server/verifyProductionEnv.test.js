/**
 * Preflight's production env check reported ".env.production: all required env
 * vars present and not placeholders" for a file whose entire Whop section was a
 * template: prod_AbCdEfGh1234, https://whop.com/checkout/plan_IjKlMnOp, an apik_
 * key the Whop API rejected as invalid, and app URLs on your-app.railway.app.
 * These lock in that template values are caught and real-looking values are not.
 */

const { detectPlaceholder, SECURITY_CHECKS } = require('../../scripts/verify-production-env');

describe('detectPlaceholder', () => {
  it.each([
    'prod_AbCdEfGh1234',
    'prod_QrStUvWx9012',
    'https://whop.com/checkout/plan_IjKlMnOp',
    'apik_abcdefghijklmnopqrstuvwxyz0',
    'ws_abcdefghijklmnopqrstuvwxyz',
    'https://your-app.railway.app',
    'noreply@your-domain.com',
    'https://click.yourdomain.com',
    'SG.abcdefghijklmnopqrstuvwxyz',
  ])('flags the template value %s', (value) => {
    expect(detectPlaceholder(value)).not.toBeNull();
  });

  it.each([
    'plan_7Hq2LmZx9Wr',
    'prod_Xm4Qa8Kt2Lp',
    'ws_9fK2mQx7Lp4ZtR8vB3nH6cW1yJ5dG0aE',
    'https://whop.com/checkout/plan_7Hq2LmZx9Wr',
    'mongodb+srv://click:Zq7mW2xL@click-cluster.wgq1ffr.mongodb.net/click',
    'https://click-platform-1.onrender.com',
    '5001',
  ])('does not flag the realistic value %s', (value) => {
    expect(detectPlaceholder(value)).toBeNull();
  });
});

describe('SECURITY_CHECKS.WHOP_CONFIG', () => {
  const combos = ['CREATOR', 'PRO', 'AGENCY'].flatMap((t) => ['MONTHLY', 'YEARLY'].map((p) => `${t}_${p}`));
  const plans = ['plan_Tm4Qx8', 'plan_Ty2Lk9', 'plan_Pm7Zr3', 'plan_Py5Wn1', 'plan_Am8Hc6', 'plan_Ay3Jd4'];
  const goodEnv = () => Object.fromEntries(combos.flatMap((c, i) => [
    [`WHOP_PRODUCT_ID_${c}`, plans[i]],
    [`NEXT_PUBLIC_WHOP_URL_${c}`, `https://whop.com/checkout/${plans[i]}`],
  ]));

  it('passes a consistent configuration', () => {
    expect(SECURITY_CHECKS.WHOP_CONFIG.check(goodEnv())).toEqual({ pass: true });
  });

  it('passes when Whop is not configured at all', () => {
    expect(SECURITY_CHECKS.WHOP_CONFIG.check({})).toEqual({ pass: true });
  });

  it('fails when one id is reused for two periods', () => {
    const env = goodEnv();
    env.WHOP_PRODUCT_ID_PRO_YEARLY = env.WHOP_PRODUCT_ID_PRO_MONTHLY;
    const r = SECURITY_CHECKS.WHOP_CONFIG.check(env);
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/more than one plan/);
  });

  it('fails when a checkout link is not on whop.com', () => {
    const env = goodEnv();
    env.NEXT_PUBLIC_WHOP_URL_AGENCY_MONTHLY = 'https://evil.example.net/checkout/plan_Am8Hc6';
    expect(SECURITY_CHECKS.WHOP_CONFIG.check(env)).toMatchObject({ pass: false });
  });

  it('fails when a link sells a different plan than the one it grants', () => {
    const env = goodEnv();
    env.NEXT_PUBLIC_WHOP_URL_CREATOR_MONTHLY = 'https://whop.com/checkout/plan_Pm7Zr3';
    const r = SECURITY_CHECKS.WHOP_CONFIG.check(env);
    expect(r.pass).toBe(false);
    expect(r.message).toMatch(/sells plan_Pm7Zr3/);
  });
});
