// Unit tests for socialResponderService.getStats — aggregation shape + scoping.
// The Mongoose model is mocked so we assert the pipeline without a DB.

jest.mock('../../server/models/SocialReply', () => ({
  aggregate: jest.fn(),
}));

const SocialReply = require('../../server/models/SocialReply');
const { getStats, ALL_STATUSES } = require('../../server/services/socialResponderService');

describe('socialResponderService.getStats', () => {
  beforeEach(() => jest.clearAllMocks());

  test('zero-fills every status and sums the total, caller-scoped', async () => {
    SocialReply.aggregate.mockResolvedValue([
      { _id: 'sent', count: 3 },
      { _id: 'rejected', count: 1 },
    ]);
    const out = await getStats('user-1', { sinceDays: 7 });

    expect(out.sinceDays).toBe(7);
    expect(out.total).toBe(4);
    expect(out.byStatus.sent).toBe(3);
    expect(out.byStatus.rejected).toBe(1);
    // Untouched statuses are present and zero.
    expect(out.byStatus.pending_approval).toBe(0);
    expect(Object.keys(out.byStatus).sort()).toEqual([...ALL_STATUSES].sort());

    const pipeline = SocialReply.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.userId).toBe('user-1');
    expect(pipeline[0].$match.createdAt.$gte).toBeInstanceOf(Date);
    expect(pipeline[1].$group._id).toBe('$status');
  });

  test('ignores unknown status buckets from the aggregation', async () => {
    SocialReply.aggregate.mockResolvedValue([
      { _id: 'sent', count: 2 },
      { _id: 'weird', count: 99 },
    ]);
    const out = await getStats('u', {});
    expect(out.total).toBe(2);
    expect(out.byStatus.weird).toBeUndefined();
  });

  test('empty aggregation → all zeros', async () => {
    SocialReply.aggregate.mockResolvedValue([]);
    const out = await getStats('u', { sinceDays: 30 });
    expect(out.total).toBe(0);
    expect(Object.values(out.byStatus).every((v) => v === 0)).toBe(true);
  });
});
