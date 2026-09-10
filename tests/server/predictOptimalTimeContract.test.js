/**
 * predictOptimalTime's call/return contract.
 *
 * Three callers (agencyService, advancedEvergreenService, abVariantService) had
 * invented their own signature — `(userId, platform, timezone)` instead of
 * `(userId, contentId, platform, options)` — and then read `result.optimalTime`,
 * a key the service has never returned. Both mistakes fail silently: the
 * timezone lands in the `platform` slot so the prediction quietly degrades to
 * generic default hours, and the phantom key is always undefined so every
 * caller fell through to `new Date()` ("post now") after paying for the full
 * prediction. The optimal-posting-time feature was dead at every consumer.
 *
 * This pins the contract both ways: the shape the service returns, and the
 * argument position each caller passes the platform in.
 */

const fs = require('fs');
const path = require('path');

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

describe('predictOptimalTime contract', () => {
  it('returns bestTime/predictions — and no top-level optimalTime', async () => {
    const r = await predictOptimalTime('u1', 'c1', 'tiktok', { dateRange: 7 });

    expect(Array.isArray(r.predictions)).toBe(true);
    expect(r.bestTime).toEqual(expect.objectContaining({
      scheduledTime: expect.any(Date),
      score: expect.any(Number),
      confidence: expect.any(String),
    }));
    // The key three callers used to read. If it ever becomes real, update the
    // callers rather than relying on both spellings.
    expect(r.optimalTime).toBeUndefined();
  });

  it('every caller passes the platform as the THIRD argument', () => {
    const SERVER = path.join(__dirname, '../../server');
    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) files.push(p);
      }
    })(SERVER);

    // The old shape was (userId, platform, timezone). Three signatures of it:
    // a platform sitting in the contentId slot (as a variable OR a literal), a
    // timezone in the platform slot, or too few arguments to reach platform.
    const PLATFORM_LITERAL = /^'(tiktok|twitter|instagram|youtube|linkedin|facebook)'$/;
    const TIMEZONE_ISH = /(^|[^a-z])(timezone|tz)([^a-z]|$)|^'UTC'$/i;
    const offenders = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?<!function\s)\bpredictOptimalTime\(([^)]*)\)/g)) {
        const args = m[1].split(',').map((a) => a.trim()).filter(Boolean);
        if (args.length < 2) continue; // a re-export or reference, not a call
        const platformInContentIdSlot = /^platforms?$/i.test(args[1]) || PLATFORM_LITERAL.test(args[1]);
        const timezoneInPlatformSlot = args.length > 2 && TIMEZONE_ISH.test(args[2]);
        if (args.length < 3 || platformInContentIdSlot || timezoneInPlatformSlot) {
          offenders.push(`${path.relative(SERVER, file)}: predictOptimalTime(${m[1]})`);
        }
      }
    }

    expect(offenders.sort()).toEqual([]);
  });
});
