// OneClickPublish sends { platform, contentId } — the route required `content`
// and 400'd every publish; and when the platform rejected a post the service
// returned { success:false } which the route answered as 200 "Posted
// successfully".
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/services/socialMediaService', () => {
  const actual = jest.requireActual('../../../server/services/socialMediaService');
  return { ...actual, postToSocialMedia: jest.fn() };
});
jest.mock('../../../server/services/oauthService', () => {
  const actual = jest.requireActual('../../../server/services/oauthService');
  return { ...actual, listSocialAccounts: jest.fn(async () => [{ accountId: 'acc-1' }]) };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { postToSocialMedia } = require('../../../server/services/socialMediaService');

const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

describe('POST /api/social/post with a contentId', () => {
  let owner; let other; let token; let otherToken; let content;

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ['spc-a@example.com', 'spc-b@example.com'] } });
    owner = await new User({ email: 'spc-a@example.com', password: 'password123', name: 'A', emailVerified: true }).save();
    other = await new User({ email: 'spc-b@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = sign(owner); otherToken = sign(other);
    content = await Content.create({
      userId: String(owner._id), type: 'video', status: 'completed', title: 'T',
      content: { text: 'The caption', mediaUrl: '/uploads/v.mp4', hashtags: ['#a'] },
    });
  });

  beforeEach(() => postToSocialMedia.mockReset());

  const post = (tok, body) => request(app).post('/api/social/post').set('Authorization', `Bearer ${tok}`).send(body);

  it('loads the owned content and posts it', async () => {
    postToSocialMedia.mockResolvedValue({ success: true, platform: 'twitter', externalId: 'x1' });
    const res = await post(token, { platform: 'twitter', contentId: String(content._id) });
    expect(res.status).toBe(200);
    const [, platform, data, options] = postToSocialMedia.mock.calls[0];
    expect(platform).toBe('twitter');
    expect(data).toMatchObject({ description: 'The caption', mediaUrl: '/uploads/v.mp4', tags: ['#a'] });
    expect(options.contentId).toBe(String(content._id));
  });

  it("another user's contentId is a 404 and nothing is posted", async () => {
    const res = await post(otherToken, { platform: 'twitter', contentId: String(content._id) });
    expect(res.status).toBe(404);
    expect(postToSocialMedia).not.toHaveBeenCalled();
  });

  it('a rejected post is a 502, not "Posted successfully"', async () => {
    postToSocialMedia.mockResolvedValue({ success: false, platform: 'twitter', error: 'Token expired' });
    const res = await post(token, { platform: 'twitter', contentId: String(content._id) });
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).toMatch(/Token expired/);
  });

  it('still requires content or a contentId', async () => {
    expect((await post(token, { platform: 'twitter' })).status).toBe(400);
  });
});
