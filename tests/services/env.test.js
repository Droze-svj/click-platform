const env = require('../../server/utils/env');

describe('utils/env predicates', () => {
  const ORIG = { NODE_ENV: process.env.NODE_ENV, RENDER: process.env.RENDER };
  afterEach(() => {
    process.env.NODE_ENV = ORIG.NODE_ENV;
    if (ORIG.RENDER === undefined) delete process.env.RENDER; else process.env.RENDER = ORIG.RENDER;
  });

  it('isProductionLike covers production AND staging', () => {
    process.env.NODE_ENV = 'production';
    expect(env.isProductionLike()).toBe(true);
    process.env.NODE_ENV = 'staging';
    expect(env.isProductionLike()).toBe(true);
    process.env.NODE_ENV = 'development';
    expect(env.isProductionLike()).toBe(false);
  });

  it('assertDeployedEnvSane flags a cloud host with a non-prod NODE_ENV', () => {
    process.env.RENDER = '1';
    process.env.NODE_ENV = '';
    const errors = [];
    const ok = env.assertDeployedEnvSane({ error: (m) => errors.push(m) });
    expect(ok).toBe(false);
    expect(errors[0]).toMatch(/DEPLOYED on a cloud platform/);
  });

  it('assertDeployedEnvSane passes for a proper production cloud host', () => {
    process.env.RENDER = '1';
    process.env.NODE_ENV = 'production';
    expect(env.assertDeployedEnvSane({ error: () => {} })).toBe(true);
  });

  it('assertDeployedEnvSane passes for local (no cloud platform) dev', () => {
    delete process.env.RENDER;
    process.env.NODE_ENV = 'development';
    expect(env.assertDeployedEnvSane({ error: () => {} })).toBe(true);
  });
});
