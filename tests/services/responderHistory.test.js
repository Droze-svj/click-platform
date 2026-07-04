// Unit tests for socialResponderService.listHistory — status filtering + scoping.
// The Mongoose model is mocked so we assert the exact query without a DB.

jest.mock('../../server/models/SocialReply', () => {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ _id: 'x' }]),
  };
  return { find: jest.fn(() => chain), __chain: chain };
});

const SocialReply = require('../../server/models/SocialReply');
const { listHistory, HISTORY_STATUSES } = require('../../server/services/socialResponderService');

describe('socialResponderService.listHistory', () => {
  beforeEach(() => jest.clearAllMocks());

  test('defaults to all resolved statuses, scoped to the caller (never pending)', async () => {
    await listHistory('user-1', {});
    expect(SocialReply.find).toHaveBeenCalledWith({
      userId: 'user-1',
      status: { $in: HISTORY_STATUSES },
    });
    expect(HISTORY_STATUSES).not.toContain('pending_approval');
  });

  test('honors a valid status subset', async () => {
    await listHistory('u', { statuses: ['sent', 'rejected'] });
    expect(SocialReply.find).toHaveBeenCalledWith({
      userId: 'u',
      status: { $in: ['sent', 'rejected'] },
    });
  });

  test('drops unknown statuses and falls back to all when none remain', async () => {
    await listHistory('u', { statuses: ['bogus', 'pending_approval'] });
    expect(SocialReply.find).toHaveBeenCalledWith({
      userId: 'u',
      status: { $in: HISTORY_STATUSES },
    });
  });

  test('applies pagination and newest-first sort', async () => {
    await listHistory('u', { limit: 10, skip: 20 });
    expect(SocialReply.__chain.skip).toHaveBeenCalledWith(20);
    expect(SocialReply.__chain.limit).toHaveBeenCalledWith(10);
    expect(SocialReply.__chain.sort).toHaveBeenCalledWith({ updatedAt: -1, createdAt: -1 });
  });

  test('coerces a non-string userId with String()', async () => {
    await listHistory(12345, {});
    expect(SocialReply.find).toHaveBeenCalledWith(expect.objectContaining({ userId: '12345' }));
  });
});
