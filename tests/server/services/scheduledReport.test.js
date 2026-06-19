const {
  calculateNextGeneration, calculatePeriod,
} = require('../../../server/services/scheduledReportService');

describe('calculateNextGeneration', () => {
  it('always returns a time strictly in the future', () => {
    for (const frequency of ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']) {
      const next = calculateNextGeneration({ frequency, time: '09:00', dayOfWeek: 1, dayOfMonth: 1 });
      expect(next.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('handles quarterly/yearly (the enum values the old code dropped to the past)', () => {
    // Regression: these frequencies used to fall through the switch and return a
    // past time, re-firing the report on every cron tick.
    const q = calculateNextGeneration({ frequency: 'quarterly', time: '00:00', dayOfMonth: 1 });
    const y = calculateNextGeneration({ frequency: 'yearly', time: '00:00', dayOfMonth: 1 });
    expect(q.getTime()).toBeGreaterThan(Date.now());
    expect(y.getTime()).toBeGreaterThan(Date.now());
  });

  it('falls back to the future for an unknown/missing frequency or time', () => {
    expect(calculateNextGeneration({}).getTime()).toBeGreaterThan(Date.now());
    expect(calculateNextGeneration({ frequency: 'bogus' }).getTime()).toBeGreaterThan(Date.now());
  });

  it('daily next is within the next 24h', () => {
    const next = calculateNextGeneration({ frequency: 'daily', time: '09:00' });
    expect(next.getTime() - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });
});

describe('calculatePeriod', () => {
  it('returns both bounds for last_period (default)', () => {
    const p = calculatePeriod({ type: 'last_period' });
    expect(p.startDate).toBeInstanceOf(Date);
    expect(p.endDate).toBeInstanceOf(Date);
    expect(p.startDate.getTime()).toBeLessThan(p.endDate.getTime());
  });

  it('honors a rolling window of N days', () => {
    const p = calculatePeriod({ type: 'rolling', days: 7 });
    const spanDays = (p.endDate - p.startDate) / (24 * 60 * 60 * 1000);
    expect(Math.round(spanDays)).toBe(7);
  });

  it('never returns undefined bounds even for malformed custom config', () => {
    const p = calculatePeriod({ type: 'custom' }); // no customStart/customEnd
    expect(p.startDate).toBeInstanceOf(Date);
    expect(p.endDate).toBeInstanceOf(Date);
    expect(isNaN(p.startDate.getTime())).toBe(false);
  });

  it('is safe on undefined input', () => {
    const p = calculatePeriod();
    expect(p.startDate).toBeInstanceOf(Date);
    expect(p.endDate).toBeInstanceOf(Date);
  });
});
