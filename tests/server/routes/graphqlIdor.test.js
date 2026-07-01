// GraphQL IDOR / BOLA guards
//
// The /api/graphql surface previously let any authenticated caller:
//   (a) `user(id)`      → read ANY user's profile (email/name) by id, and
//   (b) `contents(userId)` → list ANY user's content by passing their id.
// Both bypassed ownership entirely. These tests assert the resolvers reject a
// cross-user request BEFORE touching the DB, and that the happy path stays
// scoped to the authenticated caller (never the client-supplied `userId`).

jest.mock('../../../server/models/Content');
jest.mock('../../../server/models/User');

const Content = require('../../../server/models/Content');
const User = require('../../../server/models/User');
const { root } = require('../../../server/routes/graphql');

describe('GraphQL IDOR guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('contents(userId)', () => {
    it('rejects a caller requesting another user\'s content', async () => {
      await expect(
        root.contents({ userId: 'victim-999' }, { userId: 'attacker-1' })
      ).rejects.toThrow('Unauthorized');
      expect(Content.find).not.toHaveBeenCalled();
    });

    it('scopes the query to the authenticated caller, ignoring nothing else', async () => {
      const chain = {
        sort: () => chain,
        limit: () => chain,
        skip: () => chain,
        lean: () => Promise.resolve([]),
      };
      Content.find = jest.fn(() => chain);

      await root.contents({ type: 'video' }, { userId: 'me-42' });

      // The DB query is keyed by the CALLER, never a client-supplied userId.
      expect(Content.find).toHaveBeenCalledWith({ userId: 'me-42', type: 'video' });
    });

    it('allows a self-scoped userId arg (equal to the caller)', async () => {
      const chain = {
        sort: () => chain,
        limit: () => chain,
        skip: () => chain,
        lean: () => Promise.resolve([]),
      };
      Content.find = jest.fn(() => chain);

      await expect(
        root.contents({ userId: 'me-42' }, { userId: 'me-42' })
      ).resolves.toEqual([]);
      expect(Content.find).toHaveBeenCalledWith({ userId: 'me-42' });
    });
  });

  describe('user(id)', () => {
    it('rejects reading another user\'s profile', async () => {
      await expect(
        root.user({ id: 'victim-999' }, { userId: 'attacker-1' })
      ).rejects.toThrow('Unauthorized');
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('allows self-lookup', async () => {
      User.findById = jest.fn(() => ({
        select: () => ({ lean: () => Promise.resolve({ _id: 'me-42', email: 'me@x.com' }) }),
      }));

      const u = await root.user({ id: 'me-42' }, { userId: 'me-42' });
      expect(u.email).toBe('me@x.com');
      expect(User.findById).toHaveBeenCalledWith('me-42');
    });
  });
});
