// Features that only read Supabase were dead in production (MongoDB only):
// the Posts page could never save, analytics tiles were always zero, the post
// analytics page crashed, the creator Performance page got the admin monitor
// (403) and the admin dashboard 500'd. These run with Supabase unset, as
// production does.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const ScheduledPost = require('../../../server/models/ScheduledPost');
const BlogPost = require('../../../server/models/BlogPost');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

const sign = (u) => jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });

describe('MongoDB-backed features', () => {
  let user; let other; let token; let otherToken;

  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ['mbf-a@example.com', 'mbf-b@example.com'] } });
    user = await new User({ email: 'mbf-a@example.com', password: 'password123', name: 'A', emailVerified: true }).save();
    other = await new User({ email: 'mbf-b@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = sign(user); otherToken = sign(other);
    const posted = (platform, views, likes, daysAgo, text) => ({
      userId: String(user._id), platform, status: 'posted', scheduledTime: new Date(), postedAt: new Date(Date.now() - daysAgo * 86400000),
      content: { text }, analytics: { engagementBreakdown: { views, likes, shares: 1, comments: 1 } },
    });
    await ScheduledPost.create([
      posted('tiktok', 1000, 50, 1, 'Hook one\nbody'),
      posted('tiktok', 3000, 90, 2, 'Hook two'),
      posted('instagram', 400, 10, 3, 'Gram one'),
      posted('instagram', 600, 20, 20, 'Gram two'),
    ]);
  });

  const as = (t) => (r) => r.set('Authorization', `Bearer ${t}`);

  it('analytics dashboard reports the real totals', async () => {
    const res = await as(token)(request(app).get('/api/analytics/dashboard'));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ totalPosts: 4, publishedPosts: 4, totalViews: 5000 });
    expect(res.body.platform_distribution.tiktok).toMatchObject({ posts: 2, views: 4000 });
    expect(res.body.recent_posts.length).toBeGreaterThan(0);
    expect(res.body.recent_posts[0]).toMatchObject({ status: 'published' });
  });

  it('post analytics returns the post the page renders, and only to its owner', async () => {
    const p = await ScheduledPost.findOne({ userId: String(user._id), platform: 'tiktok' }).sort({ postedAt: -1 });
    const res = await as(token)(request(app).get(`/api/analytics/posts/${p._id}`));
    expect(res.status).toBe(200);
    expect(res.body.post).toMatchObject({ title: 'Hook one' });
    expect(res.body.analytics[0]).toMatchObject({ views: 1000, likes: 50 });
    expect((await as(otherToken)(request(app).get(`/api/analytics/posts/${p._id}`))).status).toBe(404);
  });

  it('daily performance groups posts by day for a creator (not the admin monitor)', async () => {
    const res = await as(token)(request(app).get('/api/analytics/daily-performance?period=7'));
    expect(res.status).toBe(200);
    expect(res.body.performance_data.reduce((s, d) => s + d.posts_count, 0)).toBe(3);
  });

  it('overview counts the week and gives an insight grounded in the numbers', async () => {
    const res = await as(token)(request(app).get('/api/analytics/overview'));
    expect(res.body.videosThisWeek).toBe(3);
    expect(res.body.aiInsight.quote).toMatch(/Tiktok posts average 2,000 views/);
  });

  it('admin dashboard loads on MongoDB', async () => {
    const email = `mbf-admin-${Date.now()}@example.com`;
    const admin = await new User({ email, password: 'password123', name: 'Ad Min', emailVerified: true }).save();
    const prev = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = email;
    let res;
    try {
      res = await as(sign(admin))(request(app).get('/api/admin/dashboard'));
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = prev;
    }
    expect(res.status).toBe(200);
    expect(res.body.overview.posts.published).toBeGreaterThanOrEqual(4);
    expect(res.body.recent_activity.posts[0].users.email).toBe('mbf-a@example.com');
  });

  it('posts: create, list, edit, schedule, delete — owner only', async () => {
    const created = await as(token)(request(app).post('/api/posts')).send({ title: "Tom's first post", content: 'Body & more', tags: ['a'] });
    expect(created.status).toBe(201);
    const id = created.body.post.id;
    expect(created.body.post).toMatchObject({ title: "Tom's first post", content: 'Body & more', status: 'draft', slug: 'tom-s-first-post' });

    const list = await as(token)(request(app).get('/api/posts'));
    expect(list.body.posts.map((p) => p.id)).toContain(id);
    expect((await as(otherToken)(request(app).get('/api/posts'))).body.posts).toHaveLength(0);
    expect((await as(otherToken)(request(app).put(`/api/posts/${id}`)).send({ title: 'x' })).status).toBe(404);

    const edited = await as(token)(request(app).put(`/api/posts/${id}`)).send({ excerpt: 'Short' });
    expect(edited.body.post.excerpt).toBe('Short');

    expect((await as(token)(request(app).post(`/api/posts/${id}/schedule`)).send({ scheduled_at: new Date(Date.now() - 1000).toISOString() })).status).toBe(400);
    await BlogPost.updateOne({ _id: id }, { status: 'scheduled', scheduledAt: new Date(Date.now() - 1000) });
    const after = await as(token)(request(app).get(`/api/posts/${id}`));
    expect(after.body.post.status).toBe('scheduled');
    await as(token)(request(app).get('/api/posts')); // listing publishes due posts
    expect((await BlogPost.findById(id)).status).toBe('published');

    expect((await as(token)(request(app).delete(`/api/posts/${id}`))).status).toBe(200);
    expect(await BlogPost.findById(id)).toBeNull();
  });
});
