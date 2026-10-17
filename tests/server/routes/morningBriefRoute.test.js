/**
 * /api/brief — Morning Brief endpoints.
 * GET /today returns the built brief for the caller; the subscription endpoints
 * validate the IANA timezone (which arrives sanitizer-escaped: "/" → "&#x2F;"),
 * clamp the hour, and report whether this deployment will actually deliver.
 */

const mockGetBrief = jest.fn();
const mockFindOne = jest.fn();
const mockUpsert = jest.fn();
let mockEnabled = false;

jest.mock('../../../server/middleware/auth', () => (req, res, next) => {
  req.user = { _id: 'user-1' };
  next();
});
jest.mock('../../../server/models/BriefSubscription', () => ({
  findOne: (...a) => ({ lean: () => mockFindOne(...a) }),
  findOneAndUpdate: (...a) => ({ lean: () => mockUpsert(...a) }),
}));
jest.mock('../../../server/services/morningBriefService', () => {
  const actual = jest.requireActual('../../../server/services/morningBriefService');
  return {
    ...actual,
    getBriefForUser: (...a) => mockGetBrief(...a),
    briefEnabled: () => mockEnabled,
  };
});

const express = require('express');
const request = require('supertest');
const router = require('../../../server/routes/morning-brief');

const app = express();
app.use(express.json());
app.use('/api/brief', router);

beforeEach(() => {
  mockGetBrief.mockReset();
  mockFindOne.mockReset().mockResolvedValue(null);
  mockUpsert.mockReset().mockImplementation(async (q, { $set }) => ({ userId: q.userId, lastSentLocalDate: null, ...$set }));
  mockEnabled = false;
});

test('GET /today returns the caller\'s brief', async () => {
  mockGetBrief.mockResolvedValue({ makeNext: { title: 'x' } });
  const res = await request(app).get('/api/brief/today').expect(200);
  expect(mockGetBrief).toHaveBeenCalledWith('user-1');
  expect(res.body.data.makeNext.title).toBe('x');
});

test('GET /subscription reports null + whether delivery is active on this server', async () => {
  const res = await request(app).get('/api/brief/subscription').expect(200);
  expect(res.body.data).toEqual({ subscription: null, deliveryActive: false });
});

test('PUT /subscription un-escapes the timezone, defaults the hour to 7', async () => {
  mockEnabled = true;
  const res = await request(app).put('/api/brief/subscription').send({ enabled: true, timezone: 'Europe&#x2F;Rome', hour: 'x' }).expect(200);
  expect(mockUpsert).toHaveBeenCalledWith(
    { userId: 'user-1' },
    { $set: { enabled: true, hour: 7, timezone: 'Europe/Rome' } },
    expect.objectContaining({ upsert: true }),
  );
  expect(res.body.data).toMatchObject({ subscription: { enabled: true, timezone: 'Europe/Rome', hour: 7 }, deliveryActive: true });
});

test('PUT /subscription rejects an invalid timezone when enabling', async () => {
  await request(app).put('/api/brief/subscription').send({ enabled: true, timezone: 'Mars/Olympus' }).expect(400);
  expect(mockUpsert).not.toHaveBeenCalled();
});

test('PUT /subscription can turn an existing subscription off without a timezone', async () => {
  mockFindOne.mockResolvedValue({ userId: 'user-1', enabled: true, timezone: 'Europe/Rome', hour: 7 });
  await request(app).put('/api/brief/subscription').send({ enabled: false, hour: 30 }).expect(200);
  expect(mockUpsert).toHaveBeenCalledWith({ userId: 'user-1' }, { $set: { enabled: false, hour: 7 } }, expect.any(Object));
});

test('turning off with no subscription is a no-op, not an invalid record', async () => {
  const res = await request(app).put('/api/brief/subscription').send({ enabled: false }).expect(200);
  expect(mockUpsert).not.toHaveBeenCalled();
  expect(res.body.data.subscription).toBeNull();
});
