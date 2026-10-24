// Teams: owner and members must come back as { _id, name, email } — the
// client keys owner controls off ownerId._id / members[].userId._id. The
// String fields have no `ref`, so the old bare populate() did nothing and every
// owner saw a read-only team full of "?".
// Also: an invitation whose email could not be sent must say so and hand back
// the link instead of claiming it was sent.
// The connection + in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/services/emailService', () => ({
  ...jest.requireActual('../../../server/services/emailService'),
  sendTeamInvitationEmail: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Team = require('../../../server/models/Team');
const TeamInvitation = require('../../../server/models/TeamInvitation');
const { sendTeamInvitationEmail } = require('../../../server/services/emailService');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('teams', () => {
  let owner;
  let token;
  let teamId;

  beforeEach(async () => {
    await User.deleteMany({ email: /teams-populate/ });
    await Team.deleteMany({});
    await TeamInvitation.deleteMany({});
    owner = await new User({
      email: 'teams-populate-owner@example.com', password: 'password123', name: 'Olivia Owner', emailVerified: true,
      subscription: { plan: 'agency', status: 'active' },
    }).save();
    token = jwt.sign({ userId: String(owner._id) }, getJwtSecret(), { expiresIn: '1h' });
    const created = await request(app).post('/api/teams').set('Authorization', `Bearer ${token}`).send({ name: 'Studio' });
    expect(created.status).toBe(201);
    teamId = created.body.data._id;
  });

  const authed = (r) => r.set('Authorization', `Bearer ${token}`);

  it('returns the owner and members with their name and email', async () => {
    const one = await authed(request(app).get(`/api/teams/${teamId}`));
    expect(one.status).toBe(200);
    expect(one.body.data.ownerId).toMatchObject({ _id: String(owner._id), name: 'Olivia Owner', email: owner.email });
    expect(one.body.data.members[0].userId).toMatchObject({ _id: String(owner._id), name: 'Olivia Owner' });
    expect(one.body.data.members[0].role).toBe('owner');

    const list = await authed(request(app).get('/api/teams'));
    expect(list.status).toBe(200);
    expect(list.body.data[0].ownerId).toMatchObject({ _id: String(owner._id), name: 'Olivia Owner' });
  });

  it('says the invite email was not sent and returns the link to share', async () => {
    sendTeamInvitationEmail.mockResolvedValueOnce({ success: false, error: 'Email service not configured' });
    const res = await authed(request(app).post(`/api/teams/${teamId}/invite-by-email`)).send({ email: 'teams-populate-new@example.com', role: 'editor' });
    expect(res.status).toBe(200);
    expect(res.body.data.invitationSent).toBe(false);
    const invite = await TeamInvitation.findOne({ email: 'teams-populate-new@example.com' }).lean();
    expect(res.body.data.inviteUrl).toMatch(new RegExp(`/teams/accept\\?token=${invite.token}$`));
  });

  it('reports a sent invite as sent', async () => {
    sendTeamInvitationEmail.mockResolvedValueOnce({ success: true, messageId: 'm1' });
    const res = await authed(request(app).post(`/api/teams/${teamId}/invite-by-email`)).send({ email: 'teams-populate-new2@example.com' });
    expect(res.body.data).toMatchObject({ invitationSent: true });
    expect(res.body.data.inviteUrl).toBeUndefined();
  });
});
