// Behavioral tests for Optimal-Time Auto-Schedule (pure + injected deps).

const {
  pickBestHours,
  nextSlots,
  computeOptimalSlots,
} = require('../../server/services/optimalScheduleService');

describe('optimalSchedule.pickBestHours', () => {
  test('prefers history hours ranked by engagement (top 3, de-duped)', () => {
    const hist = [
      { hour: 9, averageEngagement: 50 },
      { hour: 20, averageEngagement: 90 },
      { hour: 13, averageEngagement: 70 },
      { hour: 6, averageEngagement: 10 },
    ];
    const { hours, source } = pickBestHours(hist, [{ start: 7 }]);
    expect(source).toBe('history');
    expect(hours).toEqual([20, 13, 9]); // ranked desc, top 3
  });

  test('falls back to niche window starts when history is empty/zero', () => {
    const { hours, source } = pickBestHours([{ hour: 9, averageEngagement: 0 }], [{ start: 7 }, { start: 19 }]);
    expect(source).toBe('niche-default');
    expect(hours).toEqual([7, 19]);
  });

  test('falls back to a default when there is neither history nor windows', () => {
    const { hours, source } = pickBestHours([], []);
    expect(source).toBe('default');
    expect(hours).toEqual([9, 19]);
  });
});

describe('optimalSchedule.nextSlots', () => {
  const from = Date.parse('2026-03-02T10:00:00Z'); // 10:00 UTC

  test('produces N future slots, one per day, on the ranked hours', () => {
    const slots = nextSlots([20, 9], 3, from);
    expect(slots).toHaveLength(3);
    // day0 @20:00 (future), day1 @09:00, day2 @20:00
    expect(slots[0].toISOString()).toBe('2026-03-02T20:00:00.000Z');
    expect(slots[1].toISOString()).toBe('2026-03-03T09:00:00.000Z');
    expect(slots[2].toISOString()).toBe('2026-03-04T20:00:00.000Z');
  });

  test('skips a first-day hour that has already passed', () => {
    // 09:00 already passed at from=10:00, so the first slot rolls to a later day.
    const slots = nextSlots([9], 2, from);
    expect(slots[0].toISOString()).toBe('2026-03-03T09:00:00.000Z');
    expect(slots[1].toISOString()).toBe('2026-03-04T09:00:00.000Z');
  });

  test('all slots are strictly in the future and chronological', () => {
    const slots = nextSlots([20, 9, 13], 5, from);
    expect(slots).toHaveLength(5);
    for (let i = 0; i < slots.length; i++) {
      expect(slots[i].getTime()).toBeGreaterThan(from);
      if (i > 0) expect(slots[i].getTime()).toBeGreaterThan(slots[i - 1].getTime());
    }
  });

  test('count 0 → empty', () => {
    expect(nextSlots([9], 0, from)).toHaveLength(0);
  });
});

describe('optimalSchedule.computeOptimalSlots (injected deps)', () => {
  const now = Date.parse('2026-03-02T06:00:00Z');
  const deps = {
    now,
    getHistory: async () => ({ optimalHours: [{ hour: 18, averageEngagement: 100 }] }),
    getNiche: async () => 'fitness',
    nicheWindows: () => [{ start: 7 }],
  };

  test('uses history hours and lays out slots from now', async () => {
    const out = await computeOptimalSlots('u', 'tiktok', 2, deps);
    expect(out).toMatchObject({ platform: 'tiktok', niche: 'fitness', source: 'history', hours: [18] });
    expect(out.slots).toHaveLength(2);
    expect(out.slots[0].toISOString()).toBe('2026-03-02T18:00:00.000Z');
  });

  test('a failing history lookup degrades to niche windows, never throws', async () => {
    const out = await computeOptimalSlots('u', 'tiktok', 1, {
      ...deps,
      getHistory: async () => { throw new Error('db down'); },
    });
    expect(out.source).toBe('niche-default');
    expect(out.hours).toEqual([7]);
  });
});
