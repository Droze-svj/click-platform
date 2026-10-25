// contentRecyclingService populated 'content.contentId' — a path ScheduledPost
// does not have — so strictPopulate threw and the CulturalArbitrageHUD /
// recycling endpoints always 500'd. Titles are now looked up by the real
// top-level contentId.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const recycling = require('../../../server/services/contentRecyclingService');

describe('resurrection candidates', () => {
  let user; let token; let content;
  beforeAll(async () => {
    await User.deleteMany({ email: 'rsc@example.com' });
    user = await new User({ email: 'rsc@example.com', password: 'password123', name: 'R', emailVerified: true }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    content = await Content.create({ userId: String(user._id), type: 'video', title: 'Old banger', status: 'completed' });
    await ScheduledPost.create({
      userId: String(user._id), platform: 'tiktok', status: 'posted', contentId: String(content._id),
      scheduledTime: new Date(Date.now() - 200 * 86400000), postedAt: new Date(Date.now() - 200 * 86400000),
      content: { text: 'old post' }, analytics: { engagement: 900, engagementBreakdown: { views: 50000 } },
    });
  });

  it('GET /api/click/resurrection-candidates answers 200 with the real title', async () => {
    const res = await request(app).get('/api/click/resurrection-candidates').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ title: 'Old banger', contentId: String(content._id), historicalViews: 50000 });
  });

  it('identifyRecyclableContent no longer throws on the populate', async () => {
    const out = await recycling.identifyRecyclableContent(String(user._id), { minEngagement: 0, daysSincePost: 1 });
    expect(Array.isArray(out)).toBe(true);
  });
});
