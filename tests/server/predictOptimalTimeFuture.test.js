// Deps are stubbed so the prediction maths is what gets exercised.
jest.mock('../../server/services/contentCalendarService', () => ({
  getOptimalPostingTimes: jest.fn(async () => ({ tiktok: ['09:00', '13:00', '17:00'] })),
}));
jest.mock('../../server/services/advancedAudienceInsightsService', () => ({
  getAudienceInsights: jest.fn(async () => ({ hasData: false })),
}));
jest.mock('../../server/services/contentPerformanceService', () => ({
  getContentPerformance: jest.fn(async () => null),
}));

const { predictOptimalTime } = require('../../server/services/smartScheduleOptimizationService');

describe('predictOptimalTime never returns a slot in the past', () => {
  afterEach(() => jest.useRealTimers());

  it('skips slots that already passed today', async () => {
    // 18:00 LOCAL — every one of today's 09/13/17 slots is behind us.
    // Constructed in local time because the service builds slots with
    // setHours(), which is local; a UTC instant would drift by offset.
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15, 18, 0, 0));
    const r = await predictOptimalTime('u1', 'c1', 'tiktok', { dateRange: 7 });
    expect(r.predictions.length).toBeGreaterThan(0);
    for (const p of r.predictions) expect(p.scheduledTime.getTime()).toBeGreaterThan(Date.now());
    expect(r.bestTime.scheduledTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns bestTime null (and does not throw) when the whole window has passed', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 15, 23, 30, 0));
    const r = await predictOptimalTime('u1', 'c1', 'tiktok', { dateRange: 1 });
    expect(r.predictions).toEqual([]);
    expect(r.bestTime).toBeNull();
    expect(Array.isArray(r.recommendations)).toBe(true);
  });
});
