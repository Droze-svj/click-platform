// Notifications page: the "Read" filter sent read=true (ignored → everything),
// categories outside the old whitelist (publishing/recurring/brief) were
// ignored, and the live socket payload had id/timestamp but no _id/createdAt,
// so the bell could not key or mark-read a live notification.
//
// The connection + isolated in-memory DB are owned by tests/setup.js.

const emitted = [];
jest.mock('../../../server/services/socketService', () => {
  const actual = jest.requireActual('../../../server/services/socketService');
  return {
    ...actual,
    getIO: () => ({ to: () => ({ emit: (event, payload) => emitted.push({ event, payload }) }) }),
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server/index');
const User = require('../../../server/models/User');
const Notification = require('../../../server/models/Notification');
const notificationService = require('../../../server/services/notificationService');
const { getJwtSecret } = require('../../../server/utils/jwtSecret');

describe('notifications filters + live payload', () => {
  let user; let token;
  beforeAll(async () => {
    await User.deleteMany({ email: 'nf@example.com' });
    user = await new User({ email: 'nf@example.com', password: 'password123', name: 'N', emailVerified: true }).save();
    token = jwt.sign({ userId: String(user._id) }, getJwtSecret(), { expiresIn: '1h' });
    const uid = String(user._id);
    await Notification.create([
      { userId: uid, title: 'read one', message: 'm', read: true, category: 'task' },
      { userId: uid, title: 'unread pub', message: 'm', read: false, category: 'publishing' },
    ]);
  });

  const get = (qs) => request(app).get(`/api/notifications${qs}`).set('Authorization', `Bearer ${token}`);

  it('read=true returns only read notifications', async () => {
    const res = await get('?read=true');
    expect(res.status).toBe(200);
    expect(res.body.data.notifications.map((n) => n.title)).toEqual(['read one']);
  });

  it('filters on every category in the model enum (publishing included)', async () => {
    const res = await get('?category=publishing');
    expect(res.body.data.notifications.map((n) => n.title)).toEqual(['unread pub']);
  });

  it('the live payload carries _id and createdAt like the REST shape', async () => {
    emitted.length = 0;
    const doc = await notificationService.createNotification(String(user._id), 'Live', 'msg', 'info', null, { category: 'system' });
    const live = emitted.find((e) => e.event === 'notification');
    expect(live).toBeTruthy();
    expect(live.payload._id).toBe(String(doc._id));
    expect(live.payload.createdAt).toBeTruthy();
    expect(live.payload.read).toBe(false);
  });
});
