// Production has no Redis: queueing a content-generation job throws, and the
// Content row the route had already saved stayed 'processing' forever (every
// retry added another stuck row). The route now runs the worker in-process and
// guarantees the row leaves 'processing'.

jest.mock('../../../server/queues', () => {
  const actual = jest.requireActual('../../../server/queues');
  return { ...actual, addContentGenerationJob: jest.fn(async () => { throw new Error('Redis not configured. Cannot add job to queue.'); }) };
});
jest.mock('../../../server/workers/contentGenerator', () => ({
  processContentJob: jest.fn(),
  initializeContentWorker: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { processContentJob } = require('../../../server/workers/contentGenerator');

const waitFor = async (fn, ms = 3000) => {
  const end = Date.now() + ms;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
};

describe('POST /api/content/generate without a queue', () => {
  let token;
  beforeAll(async () => {
    await User.deleteMany({ email: 'cgq@example.com' });
    const u = await new User({
      email: 'cgq@example.com', password: 'password123', name: 'C', emailVerified: true,
      subscription: { status: 'active', plan: 'pro' },
    }).save();
    token = jwt.sign({ userId: String(u._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const generate = () => request(app).post('/api/content/generate').set('Authorization', `Bearer ${token}`)
    .send({ text: 'A long enough piece of source text to turn into social posts for several platforms.', platforms: ['twitter'] });

  it('runs the worker in-process', async () => {
    processContentJob.mockResolvedValueOnce({ success: true });
    const res = await generate();
    expect(res.status).toBe(200);
    const id = res.body.data.contentId;
    await waitFor(() => processContentJob.mock.calls.length > 0);
    expect(processContentJob.mock.calls[0][0].contentId).toBe(String(id));
  });

  it('a worker failure marks the content failed with the reason (not processing forever)', async () => {
    processContentJob.mockRejectedValueOnce(new Error('AI quota exceeded'));
    const res = await generate();
    const id = res.body.data.contentId;
    const doc = await waitFor(async () => {
      const d = await Content.findById(id).lean();
      return d && d.status === 'failed' ? d : null;
    });
    expect(doc).toBeTruthy();
    expect(doc.errorMessage).toMatch(/quota/i);
  });
});
