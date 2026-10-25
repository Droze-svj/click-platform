// Enhanced workflows were pushed onto user.workflows — not on the User schema,
// so strict mode dropped them and nothing was ever saved; the builder then
// executed /enhanced/undefined/execute (it keyed on `id`, docs have `_id`).
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Workflow = require('../../../server/models/Workflow');
const Content = require('../../../server/models/Content');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('enhanced workflows are stored and executable', () => {
  let owner; let token; let otherToken;
  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ['ewf-a@example.com', 'ewf-b@example.com'] } });
    owner = await new User({ email: 'ewf-a@example.com', password: 'password123', name: 'A', emailVerified: true }).save();
    const other = await new User({ email: 'ewf-b@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = jwt.sign({ userId: String(owner._id) }, getJwtSecret(), { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: String(other._id) }, getJwtSecret(), { expiresIn: '1h' });
  });

  const as = (tok) => (r) => r.set('Authorization', `Bearer ${tok}`);

  it('create → listed by GET /workflows → execute runs the actions', async () => {
    const created = await as(token)(request(app).post('/api/workflows/enhanced')).send({
      name: 'Weekly draft', description: 'd', trigger: 'scheduled', enabled: true,
      actions: [{ type: 'create_content', contentType: 'article', title: 'From workflow', metadata: { userId: 'someone-else' } }],
    });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    expect(await Workflow.countDocuments({ _id: id, userId: String(owner._id) })).toBe(1);

    const list = await as(token)(request(app).get('/api/workflows'));
    const doc = list.body.data.find((w) => String(w._id) === String(id));
    expect(doc).toMatchObject({ status: 'active', definition: { trigger: 'scheduled' } });

    const run = await as(token)(request(app).post(`/api/workflows/enhanced/${id}/execute`)).send({});
    expect(run.status).toBe(200);
    expect(run.body.data.executed).toBe(true);
    expect(run.body.data.results[0]).toMatchObject({ action: 'create_content', success: true });
    const made = await Content.findById(run.body.data.results[0].result.contentId).lean();
    expect(made.userId).toBe(String(owner._id)); // metadata cannot re-own the content
    expect((await Workflow.findById(id).lean()).executionCount).toBe(1);
  });

  it("another user's workflow and a bad id are 404, not 500", async () => {
    const wf = await Workflow.create({ userId: String(owner._id), name: 'Mine', status: 'active' });
    expect((await as(otherToken)(request(app).post(`/api/workflows/enhanced/${wf._id}/execute`)).send({})).status).toBe(404);
    expect((await as(token)(request(app).post('/api/workflows/enhanced/undefined/execute')).send({})).status).toBe(404);
  });

  it('a paused workflow does not run', async () => {
    const wf = await Workflow.create({ userId: String(owner._id), name: 'Paused', status: 'paused' });
    const res = await as(token)(request(app).post(`/api/workflows/enhanced/${wf._id}/execute`)).send({});
    expect(res.body.data).toMatchObject({ executed: false });
  });

  it('a nameless workflow is a 400', async () => {
    expect((await as(token)(request(app).post('/api/workflows/enhanced')).send({})).status).toBe(400);
  });
});
