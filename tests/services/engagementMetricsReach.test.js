// getEngagementMetrics computed totalReach but never returned it, so the weekly
// digest (which reads totalReach for its prior-week engagement rate and its
// summary) always saw 0 reach: every digest said trend "new" with 0 reach.

const mockAggregate = jest.fn();
jest.mock('../../server/models/ScheduledPost', () => ({
  aggregate: (...a) => mockAggregate(...a),
  find: () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) }),
}));
jest.mock('../../server/models/Content', () => ({}));
jest.mock('../../server/models/User', () => ({}));
jest.mock('../../server/services/cacheService', () => ({ getOrSet: jest.fn() }));

const { getEngagementMetrics } = require('../../server/services/businessIntelligenceService');

test('returns totalReach alongside views/engagement/rate', async () => {
  mockAggregate.mockResolvedValue([{ totalViews: 900, totalEngagement: 50, totalReach: 1000 }]);
  const out = await getEngagementMetrics('u1', new Date());
  expect(out).toMatchObject({ totalViews: 900, totalEngagement: 50, totalReach: 1000, averageEngagementRate: 5 });
});

test('the error fallback also carries totalReach: 0', async () => {
  mockAggregate.mockRejectedValue(new Error('db down'));
  const out = await getEngagementMetrics('u1', new Date());
  expect(out.totalReach).toBe(0);
});
