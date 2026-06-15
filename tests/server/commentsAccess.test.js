// Comments access-model: generic comments are team-scoped (membership gate, with
// content-access defense-in-depth for entityType 'content'); post/inline comments
// inherit the parent post's owner-or-workspace access.

jest.mock('../../server/models/Team', () => ({ exists: jest.fn() }));
jest.mock('../../server/models/Content');
jest.mock('../../server/models/ScheduledPost');
jest.mock('../../server/models/PostComment');
jest.mock('../../server/middleware/workspaceIsolation', () => ({ verifyWorkspaceAccess: jest.fn() }));

const Team = require('../../server/models/Team');
const Content = require('../../server/models/Content');
const ScheduledPost = require('../../server/models/ScheduledPost');
const { verifyWorkspaceAccess } = require('../../server/middleware/workspaceIsolation');
const { teamAccessible, accessibleContent, accessiblePost } = require('../../server/utils/resourceAccess');

const reqFor = (id) => ({ user: { _id: id } });
const lean = (doc) => ({ select: () => ({ lean: () => Promise.resolve(doc) }) });

describe('teamAccessible', () => {
  test('true when the caller owns/belongs to the team, false otherwise', async () => {
    Team.exists.mockResolvedValueOnce({ _id: 'T1' });
    expect(await teamAccessible(reqFor('U1'), 'T1')).toBe(true);
    Team.exists.mockResolvedValueOnce(null);
    expect(await teamAccessible(reqFor('ATTACKER'), 'T1')).toBe(false);
  });

  test('false (no DB call) without a teamId', async () => {
    Team.exists.mockClear();
    expect(await teamAccessible(reqFor('U1'), undefined)).toBe(false);
    expect(Team.exists).not.toHaveBeenCalled();
  });

  test('scopes the membership query to owner OR member', async () => {
    Team.exists.mockResolvedValueOnce({ _id: 'T1' });
    await teamAccessible(reqFor('U1'), 'T1');
    const arg = Team.exists.mock.calls.pop()[0];
    expect(String(arg._id)).toBe('T1');
    expect(JSON.stringify(arg.$or)).toContain('ownerId');
    expect(JSON.stringify(arg.$or)).toContain('members.userId');
  });
});

describe('accessibleContent (defense-in-depth for content comments)', () => {
  test('owner gets the content', async () => {
    Content.findById.mockReturnValue(lean({ userId: 'U1' }));
    expect(await accessibleContent(reqFor('U1'), 'C1')).toBeTruthy();
  });

  test('non-owner WITHOUT workspace access → null', async () => {
    Content.findById.mockReturnValue(lean({ userId: 'OWNER', workspaceId: 'W1' }));
    verifyWorkspaceAccess.mockResolvedValue({ allowed: false });
    expect(await accessibleContent(reqFor('ATTACKER'), 'C1')).toBeNull();
  });

  test('non-owner WITH workspace access → content', async () => {
    Content.findById.mockReturnValue(lean({ userId: 'OWNER', workspaceId: 'W1' }));
    verifyWorkspaceAccess.mockResolvedValue({ allowed: true });
    expect(await accessibleContent(reqFor('MEMBER'), 'C1')).toBeTruthy();
  });

  test('missing content → null', async () => {
    Content.findById.mockReturnValue(lean(null));
    expect(await accessibleContent(reqFor('U1'), 'C1')).toBeNull();
  });
});

describe('accessiblePost (post/inline comments inherit it)', () => {
  test('owner → post, foreign user with no workspace → null', async () => {
    ScheduledPost.findById.mockReturnValue(lean({ userId: 'U1' }));
    expect(await accessiblePost(reqFor('U1'), 'P1')).toBeTruthy();
    ScheduledPost.findById.mockReturnValue(lean({ userId: 'OWNER' }));
    expect(await accessiblePost(reqFor('ATTACKER'), 'P1')).toBeNull();
  });
});
