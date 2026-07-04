// Behavioral tests for the Posting Heatmap pure builder (no DB).

const { buildHeatmap, getHeatmap, DAYS } = require('../../server/services/postingHeatmapService');

// UTC times so day/hour are deterministic.
const at = (iso, engagement) => ({ postedAt: new Date(iso), engagement });

describe('postingHeatmap.buildHeatmap', () => {
  test('empty history → empty grid, no peak', () => {
    expect(buildHeatmap([])).toEqual({ grid: [], peak: null, totalPosts: 0 });
  });

  test('groups by UTC day+hour and averages engagement per cell', () => {
    const posts = [
      at('2026-01-04T09:00:00Z', 100), // Sunday 09:00
      at('2026-01-04T09:30:00Z', 200), // Sunday 09:00 (same cell)
      at('2026-01-05T20:00:00Z', 50),  // Monday 20:00
    ];
    const { grid, totalPosts } = buildHeatmap(posts);
    expect(totalPosts).toBe(3);
    const sun9 = grid.find((c) => c.day === 0 && c.hour === 9);
    expect(sun9).toEqual({ day: 0, hour: 9, count: 2, avgEngagement: 150 });
    const mon20 = grid.find((c) => c.day === 1 && c.hour === 20);
    expect(mon20).toMatchObject({ count: 1, avgEngagement: 50 });
  });

  test('peak is the highest-average cell', () => {
    const posts = [at('2026-01-04T09:00:00Z', 100), at('2026-01-05T20:00:00Z', 500)];
    expect(buildHeatmap(posts).peak).toEqual({ day: 1, hour: 20, avgEngagement: 500 });
  });

  test('the grid is sparse (only cells with posts)', () => {
    const { grid } = buildHeatmap([at('2026-01-04T09:00:00Z', 10)]);
    expect(grid).toHaveLength(1);
  });

  test('ignores invalid/missing dates', () => {
    const { totalPosts } = buildHeatmap([
      { postedAt: 'not-a-date', engagement: 5 },
      { engagement: 5 },
      at('2026-01-04T09:00:00Z', 10),
    ]);
    expect(totalPosts).toBe(1);
  });

  test('accepts ISO strings and numbers, defaults missing engagement to 0', () => {
    const { grid } = buildHeatmap([{ postedAt: '2026-01-04T09:00:00Z' }]);
    expect(grid[0].avgEngagement).toBe(0);
  });
});

describe('postingHeatmap.getHeatmap (injected deps)', () => {
  test('builds from fetched posts and includes day labels', async () => {
    const out = await getHeatmap('u', { getPosts: async () => [at('2026-01-04T09:00:00Z', 10)] });
    expect(out.dayLabels).toEqual(DAYS);
    expect(out.totalPosts).toBe(1);
    expect(out.peak).toMatchObject({ day: 0, hour: 9 });
  });
});
