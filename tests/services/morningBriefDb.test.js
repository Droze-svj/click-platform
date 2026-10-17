// Morning Brief against real models (in-memory Mongo from tests/setup.js):
// proves the brief's queries — field names, ObjectId vs String userIds, the
// conversion aggregate, the prior-week subtraction — pick up seeded data and
// never another user's.

const mongoose = require('mongoose');
const ScheduledPost = require('../../server/models/ScheduledPost');
const Conversion = require('../../server/models/Conversion');
const SocialReply = require('../../server/models/SocialReply');
const ApprovalRequest = require('../../server/models/ApprovalRequest');
const BriefSubscription = require('../../server/models/BriefSubscription');
const Notification = require('../../server/models/Notification');
const { getBriefForUser, deliverDueBriefs, localClock } = require('../../server/services/morningBriefService');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const me = new mongoose.Types.ObjectId();
const someoneElse = new mongoose.Types.ObjectId();
const ago = (ms) => new Date(NOW - ms);

const post = (userId, postedAt, views, engagement) => ({
  userId: String(userId), platform: 'tiktok', scheduledTime: postedAt, postedAt, status: 'posted',
  analytics: { engagement, reach: views * 2, engagementBreakdown: { views } },
});
const sale = (userId, at, value) => ({
  postId: new mongoose.Types.ObjectId(), workspaceId: new mongoose.Types.ObjectId(), userId,
  platform: 'tiktok', conversionType: 'purchase', conversionValue: value, currency: 'USD',
  conversionData: { timestamp: at },
});
const inbound = (userId, text, at, status = 'sent') => ({
  userId: String(userId), platform: 'instagram', inboundText: text, status, createdAt: at,
});

const cleanup = () => Promise.all([
  ScheduledPost.deleteMany({ userId: { $in: [String(me), String(someoneElse)] } }),
  Conversion.deleteMany({ userId: { $in: [me, someoneElse] } }),
  SocialReply.deleteMany({ userId: { $in: [String(me), String(someoneElse)] } }),
  ApprovalRequest.deleteMany({ requestedFrom: { $in: [me, someoneElse] } }),
  BriefSubscription.deleteMany({ userId: { $in: [String(me), String(someoneElse)] } }),
  Notification.deleteMany({ userId: { $in: [me, someoneElse, String(me), String(someoneElse)] } }),
]);

beforeAll(async () => {
  await cleanup();
  await ScheduledPost.insertMany([
    post(me, ago(2 * DAY), 1000, 60),
    post(me, ago(4 * DAY), 500, 30),
    post(me, ago(10 * DAY), 1000, 100), // prior week
    post(someoneElse, ago(1 * DAY), 99999, 9999),
  ]);
  await Conversion.insertMany([
    sale(me, ago(2 * HOUR), 497),
    sale(me, ago(5 * HOUR), 497),
    sale(me, ago(30 * HOUR), 497), // prior 24h
    sale(me, ago(3 * DAY), 2000),
    sale(someoneElse, ago(1 * HOUR), 25000),
  ]);
  await SocialReply.insertMany([
    inbound(me, 'What microphone do you use?', ago(3 * DAY)),
    inbound(me, 'which microphone is that?', ago(1 * DAY)),
    inbound(me, 'How much is the course? I want to buy', ago(2 * HOUR), 'pending_approval'),
    inbound(me, 'what microphone? asked last month', ago(40 * DAY)), // outside the window
    inbound(someoneElse, 'microphone microphone?', ago(1 * HOUR)),
  ]);
  await ApprovalRequest.create({
    entityType: 'script', entityId: new mongoose.Types.ObjectId(), requestedBy: me, requestedFrom: me, status: 'pending',
  });
});

afterAll(async () => { if (mongoose.connection.readyState === 1) await cleanup(); });

test('builds the brief from this user\'s real data only', async () => {
  const b = await getBriefForUser(me, { now: NOW });

  expect(b.performance).toMatchObject({ views: 1500, engagement: 90, viewsChangePct: 50, engagementChangePct: -10 });
  expect(b.sales).toEqual({
    currency: 'USD',
    last24h: { count: 2, revenue: 994 },
    revenueChangePct: 100,
    last7d: { count: 4, revenue: 3491 },
  });
  expect(b.audience).toMatchObject({ scanned: 3, questions: 2 });
  expect(b.makeNext).toMatchObject({ source: 'audience', title: 'Answer this: "which microphone is that?"' }); // newest phrasing
  expect(b.needsYou.map((n) => [n.id, n.count])).toEqual(expect.arrayContaining([['replies', 1], ['signoffs', 1]]));
});

test('delivers a due brief once as a real in-app notification (and email when chosen), never twice the same day', async () => {
  const tz = 'Europe/Rome';
  const { hour } = localClock(NOW, tz);
  await BriefSubscription.create({ userId: String(me), timezone: tz, hour, channels: { inApp: true, email: true } });
  // Not due: a different hour for someone else.
  await BriefSubscription.create({ userId: String(someoneElse), timezone: tz, hour: (hour + 3) % 24 });
  const sendEmail = jest.fn().mockResolvedValue({ success: true });

  const first = await deliverDueBriefs(NOW, { sendEmail, getUserEmail: async () => 'me@example.com', appUrl: 'https://app.example.com' });
  expect(first).toEqual({ sent: 1, failed: 0 });

  const notes = await Notification.find({ title: 'Your morning brief' }).lean();
  expect(notes).toHaveLength(1);
  expect(String(notes[0].userId)).toBe(String(me));
  expect(notes[0]).toMatchObject({ link: '/dashboard/features#brief', category: 'brief', priority: 'high' });
  expect(notes[0].message).toMatch(/Make next: Answer this:/);
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'me@example.com', subject: 'Your morning brief' }));

  const sub = await BriefSubscription.findOne({ userId: String(me) }).lean();
  expect(sub.lastSentLocalDate).toBe(localClock(NOW, tz).date);

  // The next 15-minute tick in the same hour sends nothing.
  const second = await deliverDueBriefs(NOW + 15 * 60 * 1000, { sendEmail, getUserEmail: async () => 'me@example.com' });
  expect(second).toEqual({ sent: 0, failed: 0 });
  expect(await Notification.countDocuments({ title: 'Your morning brief' })).toBe(1);
});
