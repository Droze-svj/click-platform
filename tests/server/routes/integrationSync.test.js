// The integrations page's Sync button posts {} and the route 400'd every time
// ("Content is required"). An empty sync is a pull; failures are now a clear
// 409 (inactive) / 502 (remote failed) instead of a 500.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

jest.mock('../../../server/services/integrationService', () => {
  const actual = jest.requireActual('../../../server/services/integrationService');
  return { ...actual, syncContentToIntegration: jest.fn() };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Integration = require('../../../server/models/Integration');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');
const { syncContentToIntegration } = require('../../../server/services/integrationService');

describe('POST /api/integrations/:id/sync', () => {
  let owner; let token; let otherToken; let intg;
  beforeAll(async () => {
    await User.deleteMany({ email: { $in: ['isy-a@example.com', 'isy-b@example.com'] } });
    owner = await new User({ email: 'isy-a@example.com', password: 'password123', name: 'A', emailVerified: true }).save();
    const other = await new User({ email: 'isy-b@example.com', password: 'password123', name: 'B', emailVerified: true }).save();
    token = jwt.sign({ userId: String(owner._id) }, getJwtSecret(), { expiresIn: '1h' });
    otherToken = jwt.sign({ userId: String(other._id) }, getJwtSecret(), { expiresIn: '1h' });
    intg = await Integration.create({ userId: owner._id, type: 'cms', provider: 'wordpress', name: 'Blog', status: 'active' });
  });
  beforeEach(() => syncContentToIntegration.mockReset());

  const sync = (tok, body) => request(app).post(`/api/integrations/${intg._id}/sync`).set('Authorization', `Bearer ${tok}`).send(body);

  it('an empty body is a pull, not a 400', async () => {
    syncContentToIntegration.mockResolvedValue({ success: true, syncedAt: new Date() });
    const res = await sync(token, {});
    expect(res.status).toBe(200);
    expect(syncContentToIntegration).toHaveBeenCalledWith(String(intg._id), undefined, 'pull');
  });

  it('a push without content is still a 400', async () => {
    expect((await sync(token, { direction: 'push' })).status).toBe(400);
  });

  it('inactive → 409, remote failure → 502, other user → 404', async () => {
    syncContentToIntegration.mockRejectedValueOnce(new Error('Integration not active'));
    expect((await sync(token, {})).status).toBe(409);
    syncContentToIntegration.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));
    const failed = await sync(token, {});
    expect(failed.status).toBe(502);
    expect(JSON.stringify(failed.body)).toMatch(/ECONNREFUSED/);
    expect((await sync(otherToken, {})).status).toBe(404);
  });
});
