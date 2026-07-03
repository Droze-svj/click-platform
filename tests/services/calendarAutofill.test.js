// Behavioral tests for Content Calendar Autofill core logic (pure, no DB/AI).

const {
  buildDraftRows,
  newPlanId,
  approveCalendarPlan,
  cancelCalendarPlan,
  VALID_PLATFORMS,
} = require('../../server/services/calendarAutofillService');

const IDEAS = [
  { title: 'Hook A', hook: 'First 3s A', description: 'Do X', platform: 'tiktok' },
  { title: 'Hook B', hook: 'First 3s B', description: 'Do Y', platform: 'youtube' },
  { title: 'Hook C', hook: '', description: '', platform: 'unknownnet' },
];

describe('calendarAutofill.buildDraftRows', () => {
  const startAt = Date.parse('2026-01-01T09:00:00Z');

  test('maps each idea to a pending_approval draft owned by the caller', () => {
    const rows = buildDraftRows('user123', IDEAS, { platforms: ['tiktok'], startAt, cadenceHours: 24 });
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.userId).toBe('user123');
      expect(r.status).toBe('pending_approval');
      expect(r.autopilotPlanId).toMatch(/^cal_[a-f0-9]+$/);
      expect(VALID_PLATFORMS).toContain(r.platform);
    }
  });

  test('honours a suggested platform only when requested, else round-robins', () => {
    // Only tiktok+youtube requested; idea C suggests unknownnet → round-robin.
    const rows = buildDraftRows('u', IDEAS, { platforms: ['tiktok', 'youtube'], startAt });
    expect(rows[0].platform).toBe('tiktok');   // suggested + requested
    expect(rows[1].platform).toBe('youtube');  // suggested + requested
    expect(['tiktok', 'youtube']).toContain(rows[2].platform); // fell back to round-robin
  });

  test('spreads scheduledTime by cadenceHours from startAt', () => {
    const rows = buildDraftRows('u', IDEAS, { platforms: ['tiktok'], startAt, cadenceHours: 12 });
    expect(rows[0].scheduledTime.getTime()).toBe(startAt);
    expect(rows[1].scheduledTime.getTime()).toBe(startAt + 12 * 3600 * 1000);
    expect(rows[2].scheduledTime.getTime()).toBe(startAt + 24 * 3600 * 1000);
  });

  test('caption is hook+description, falling back to title when both empty', () => {
    const rows = buildDraftRows('u', IDEAS, { platforms: ['tiktok'], startAt });
    expect(rows[0].content.text).toBe('First 3s A\n\nDo X');
    expect(rows[2].content.text).toBe('Hook C'); // hook+desc empty → title
  });

  test('invalid/empty platform set falls back to tiktok', () => {
    const rows = buildDraftRows('u', IDEAS, { platforms: ['nope'], startAt });
    expect(rows.every((r) => VALID_PLATFORMS.includes(r.platform))).toBe(true);
  });

  test('empty ideas → no rows', () => {
    expect(buildDraftRows('u', [], {})).toHaveLength(0);
    expect(buildDraftRows('u', null, {})).toHaveLength(0);
  });

  test('all rows in one call share one cal_ plan id', () => {
    const rows = buildDraftRows('u', IDEAS, { platforms: ['tiktok'], planId: newPlanId() });
    const ids = new Set(rows.map((r) => r.autopilotPlanId));
    expect(ids.size).toBe(1);
  });
});

describe('calendarAutofill approve/cancel guard', () => {
  test('reject a non-calendar / malformed plan id before any DB write', async () => {
    await expect(approveCalendarPlan('u', 'not-a-plan')).rejects.toThrow('Invalid plan id');
    await expect(approveCalendarPlan('u', 'ap_deadbeef')).rejects.toThrow('Invalid plan id');
    await expect(cancelCalendarPlan('u', '')).rejects.toThrow('Invalid plan id');
  });
});
