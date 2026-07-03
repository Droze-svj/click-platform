// Behavioral tests for the Posting Streak tracker (pure, deterministic).

const { computeStreak, bucketIndex } = require('../../server/services/postingStreakService');

const WEEK = 7 * 24 * 3600 * 1000;
// A fixed "now" mid-week so this-period math is unambiguous.
const now = Date.parse('2026-04-15T12:00:00Z'); // a Wednesday
const weeksAgo = (n) => now - n * WEEK;

describe('postingStreak.computeStreak (weekly)', () => {
  test('empty history → zeroed, broken', () => {
    expect(computeStreak([], { now })).toMatchObject({
      currentStreak: 0, longestStreak: 0, thisPeriodCount: 0, status: 'broken', lastPostedAt: null,
    });
  });

  test('posted this week + prior weeks → active streak counts consecutive weeks', () => {
    const dates = [now, weeksAgo(1), weeksAgo(2)]; // this + last + 2 weeks ago
    const s = computeStreak(dates, { now });
    expect(s.status).toBe('active');
    expect(s.currentStreak).toBe(3);
    expect(s.thisPeriodCount).toBe(1);
  });

  test('nothing this week but posted last week → at-risk, streak still counts', () => {
    const s = computeStreak([weeksAgo(1), weeksAgo(2)], { now });
    expect(s.status).toBe('at-risk');
    expect(s.currentStreak).toBe(2);
    expect(s.thisPeriodCount).toBe(0);
  });

  test('a gap breaks the current streak but longest is preserved', () => {
    // filled weeks: this, -1, then gap at -2, then -3,-4,-5
    const dates = [now, weeksAgo(1), weeksAgo(3), weeksAgo(4), weeksAgo(5)];
    const s = computeStreak(dates, { now });
    expect(s.currentStreak).toBe(2);  // this + last week
    expect(s.longestStreak).toBe(3);  // weeks -3,-4,-5
    expect(s.status).toBe('active');
  });

  test('only old posts (2+ weeks ago) → broken, currentStreak 0', () => {
    const s = computeStreak([weeksAgo(3), weeksAgo(4)], { now });
    expect(s.status).toBe('broken');
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(2);
  });

  test('multiple posts in one week count once toward the streak, but thisPeriodCount tallies them', () => {
    const s = computeStreak([now, now - 3600 * 1000, now - 2 * 3600 * 1000], { now });
    expect(s.currentStreak).toBe(1);
    expect(s.thisPeriodCount).toBe(3);
  });

  test('accepts Date, number, and ISO-string inputs; ignores garbage', () => {
    const s = computeStreak([new Date(now), weeksAgo(1), 'not-a-date', null], { now });
    expect(s.currentStreak).toBe(2);
    expect(s.lastPostedAt).toBeInstanceOf(Date);
  });
});

describe('postingStreak (daily unit)', () => {
  test('consecutive days streak with unit=day', () => {
    const DAY = 24 * 3600 * 1000;
    const s = computeStreak([now, now - DAY, now - 2 * DAY], { now, unit: 'day' });
    expect(s.unit).toBe('day');
    expect(s.currentStreak).toBe(3);
  });

  test('bucketIndex is stable per unit', () => {
    expect(bucketIndex(now, 'week')).toBe(bucketIndex(now + 3600 * 1000, 'week'));
    expect(bucketIndex(now, 'day')).toBe(Math.floor(now / (24 * 3600 * 1000)));
  });
});
