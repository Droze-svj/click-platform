const svc = require('../../server/services/alertSweepCronService');

describe('alertSweepCronService gating', () => {
  const ORIG = process.env.ENABLE_ALERT_SWEEPS;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.ENABLE_ALERT_SWEEPS;
    else process.env.ENABLE_ALERT_SWEEPS = ORIG;
  });

  it('is OFF by default (no ENABLE_ALERT_SWEEPS)', () => {
    delete process.env.ENABLE_ALERT_SWEEPS;
    expect(svc.sweepsEnabled()).toBe(false);
  });

  it('is ON only when ENABLE_ALERT_SWEEPS=true', () => {
    process.env.ENABLE_ALERT_SWEEPS = 'true';
    expect(svc.sweepsEnabled()).toBe(true);
    process.env.ENABLE_ALERT_SWEEPS = 'false';
    expect(svc.sweepsEnabled()).toBe(false);
  });

  it('guarded() does NOT run the sweep when disabled', async () => {
    delete process.env.ENABLE_ALERT_SWEEPS;
    const fn = jest.fn();
    await svc.guarded('test', fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('guarded() runs the sweep (under a lock) when enabled and Mongo is connected', async () => {
    process.env.ENABLE_ALERT_SWEEPS = 'true';
    const fn = jest.fn().mockResolvedValue();
    await svc.guarded('test-enabled', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('startAlertSweepCron() schedules nothing when disabled', () => {
    delete process.env.ENABLE_ALERT_SWEEPS;
    const tasks = svc.startAlertSweepCron();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBe(0);
    svc.stopAlertSweepCron();
  });
});
