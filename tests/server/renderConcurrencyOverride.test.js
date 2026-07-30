// RENDER_MAX_CONCURRENT lets ops tune the in-process render cap: bump it on a
// 2-core box (where cores/2 pins to 1) or cap it down on a big box to protect
// memory. Without the override it stays at the cores/2 default.

describe('getOptimalSettings render concurrency override', () => {
  const load = () => {
    let mod;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      mod = require('../../server/services/performanceOptimizationService');
    });
    return mod;
  };

  const orig = process.env.RENDER_MAX_CONCURRENT;
  afterEach(() => {
    if (orig === undefined) delete process.env.RENDER_MAX_CONCURRENT;
    else process.env.RENDER_MAX_CONCURRENT = orig;
  });

  it('honors a valid RENDER_MAX_CONCURRENT override', () => {
    process.env.RENDER_MAX_CONCURRENT = '4';
    expect(load().getOptimalSettings().maxConcurrentJobs).toBe(4);
  });

  it('falls back to the cores/2 default when unset', () => {
    delete process.env.RENDER_MAX_CONCURRENT;
    expect(load().getOptimalSettings().maxConcurrentJobs).toBeGreaterThanOrEqual(1);
  });

  it('ignores a non-numeric or <1 override (keeps the default)', () => {
    process.env.RENDER_MAX_CONCURRENT = 'nonsense';
    expect(load().getOptimalSettings().maxConcurrentJobs).toBeGreaterThanOrEqual(1);
    process.env.RENDER_MAX_CONCURRENT = '0';
    expect(load().getOptimalSettings().maxConcurrentJobs).toBeGreaterThanOrEqual(1);
  });
});
