const { analyzeCalendar } = require('../../../server/services/agencyCalendarService');

const ISO = (d) => new Date(d).toISOString();

describe('analyzeCalendar (pure)', () => {
  it('flags same client+platform posts closer than the conflict window', () => {
    const r = analyzeCalendar([
      { id: 'a', clientId: 'c1', platform: 'tiktok', scheduledTime: ISO('2026-06-20T10:00:00Z') },
      { id: 'b', clientId: 'c1', platform: 'tiktok', scheduledTime: ISO('2026-06-20T10:15:00Z') },
      { id: 'c', clientId: 'c1', platform: 'tiktok', scheduledTime: ISO('2026-06-20T12:00:00Z') },
    ], { conflictWindowMin: 30 });
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ a: 'a', b: 'b', gapMin: 15 });
  });

  it('does not cross clients or platforms when detecting conflicts', () => {
    const r = analyzeCalendar([
      { id: 'a', clientId: 'c1', platform: 'tiktok', scheduledTime: ISO('2026-06-20T10:00:00Z') },
      { id: 'b', clientId: 'c2', platform: 'tiktok', scheduledTime: ISO('2026-06-20T10:05:00Z') },
      { id: 'd', clientId: 'c1', platform: 'instagram', scheduledTime: ISO('2026-06-20T10:05:00Z') },
    ]);
    expect(r.conflicts).toHaveLength(0);
  });

  it('flags days over the per-platform capacity cap', () => {
    const posts = Array.from({ length: 4 }, (_, i) => ({
      id: `p${i}`, clientId: 'c1', platform: 'tiktok',
      scheduledTime: ISO(`2026-06-21T${String(8 + i * 3).padStart(2, '0')}:00:00Z`),
    }));
    const r = analyzeCalendar(posts, { maxPerPlatformPerDay: 3, conflictWindowMin: 5 });
    expect(r.overCapacity).toHaveLength(1);
    expect(r.overCapacity[0]).toMatchObject({ clientId: 'c1', platform: 'tiktok', count: 4, max: 3 });
  });

  it('computes workload per assignee and the busiest member', () => {
    const r = analyzeCalendar([
      { id: 'a', clientId: 'c1', platform: 'x', assignee: 'u1', scheduledTime: ISO('2026-06-20T10:00:00Z') },
      { id: 'b', clientId: 'c2', platform: 'x', assignee: 'u1', scheduledTime: ISO('2026-06-21T10:00:00Z') },
      { id: 'c', clientId: 'c3', platform: 'x', assignee: 'u2', scheduledTime: ISO('2026-06-22T10:00:00Z') },
    ]);
    expect(r.workload).toEqual({ u1: 2, u2: 1 });
    expect(r.busiestAssignee).toBe('u1');
  });

  it('is safe on empty / malformed input', () => {
    expect(analyzeCalendar()).toMatchObject({ total: 0, conflicts: [], overCapacity: [] });
    expect(analyzeCalendar([{ foo: 1 }, null, { scheduledTime: 'not-a-date' }]).total).toBe(0);
  });
});
