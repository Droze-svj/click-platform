// The publishing worker, scheduler and recurring-post cron create notifications
// with category 'publishing'/'recurring' and priority 'normal' — none of which
// the Notification schema allowed — so every "post published", "post failed"
// and recurring-post notification failed validation inside a best-effort
// try/catch and was silently dropped. The morning brief hit the same wall.

const mongoose = require('mongoose');
const Notification = require('../../server/models/Notification');
const notificationService = require('../../server/services/notificationService');

const userId = new mongoose.Types.ObjectId();
const cleanup = () => Notification.deleteMany({ userId: { $in: [String(userId), userId] } });

beforeAll(cleanup);
afterAll(async () => { if (mongoose.connection.readyState === 1) await cleanup(); });

test.each([
  ['publishing', 'normal', 'publishing', 'medium'], // socialPostProcessor / scheduler success path
  ['publishing', 'high', 'publishing', 'high'], // post failed
  ['recurring', 'normal', 'recurring', 'medium'], // recurringPostCron
  ['brief', 'high', 'brief', 'high'], // morning brief
  ['not-a-category', 'urgent', 'system', 'medium'], // unknown values are coerced, never dropped
])('category %s / priority %s is saved as %s / %s', async (category, priority, savedCategory, savedPriority) => {
  const doc = await notificationService.createNotification(userId, `t-${category}-${priority}`, 'm', 'info', '/x', { category, priority });
  expect(doc).toBeTruthy();
  const saved = await Notification.findById(doc._id).lean();
  expect(saved).toMatchObject({ category: savedCategory, priority: savedPriority });
});

test('createNotification works both as a method and destructured (it used to recurse forever)', async () => {
  const { createNotification } = notificationService;
  const viaDestructure = await createNotification(userId, 'destructured', 'm', 'info', null, {});
  const viaMethod = await notificationService.createNotification(userId, 'method', 'm', 'info', null, {});
  expect(viaDestructure && viaMethod).toBeTruthy();
  expect(await Notification.countDocuments({ userId: String(userId), title: { $in: ['destructured', 'method'] } })).toBe(2);
});

test('sendNotification persists instead of falling back to a socket-only push', async () => {
  await notificationService.sendNotification(userId, { title: 'via-send', message: 'm', type: 'info' });
  expect(await Notification.countDocuments({ userId: String(userId), title: 'via-send' })).toBe(1);
});
