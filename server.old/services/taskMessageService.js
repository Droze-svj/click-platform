// Task-scoped chat with @mentions; real-time via socket

const Task = require('../models/Task');
const TaskMessage = require('../models/TaskMessage');
const { getIO } = require('./socketService');
const logger = require('../utils/logger');

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

/**
 * Check if user can access task (view/chat). Today: task owner only; later: + workspace members.
 */
async function canAccessTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId }).lean();
  if (!task) return { allowed: false, task: null };
  const uid = normalizeUserId(userId);
  const ownerId = normalizeUserId(task.userId);
  if (ownerId === uid) return { allowed: true, task };
  // Future: if (task.workspaceId) check Workspace membership
  return { allowed: false, task };
}

async function listMessages(taskId, userId) {
  const { allowed } = await canAccessTask(userId, taskId);
  if (!allowed) return [];
  const messages = await TaskMessage.find({ taskId })
    .sort({ createdAt: 1 })
    .lean();
  return messages;
}

/**
 * Parse @mention segments from body. Supports @[userId] or plain @name (client sends mentionUserIds).
 * mentionUserIds: optional array of user ids already resolved by client.
 */
async function createMessage(taskId, userId, { body, mentionUserIds = [] }) {
  const { allowed } = await canAccessTask(userId, taskId);
  if (!allowed) return null;
  const msg = new TaskMessage({
    taskId,
    userId: normalizeUserId(userId),
    body: (body || '').trim().slice(0, 8000),
    mentionUserIds: Array.isArray(mentionUserIds) ? mentionUserIds : []
  });
  await msg.save();
  const out = msg.toObject();
  try {
    const io = getIO();
    const room = `task:${taskId}`;
    io.to(room).emit('task:message', { message: out });
  } catch (e) {
    logger.warn('Task message socket emit failed', { taskId, error: e.message });
  }
  const notificationService = require('./notificationService');
  for (const mentionedId of out.mentionUserIds || []) {
    const mid = normalizeUserId(mentionedId);
    if (mid && mid !== normalizeUserId(userId)) {
      try {
        await notificationService.createNotification(
          mentionedId,
          'You were mentioned in a task',
          (body || '').slice(0, 120),
          'info',
          `/dashboard/tasks?open=${taskId}`,
          { category: 'mention', context: { entityId: taskId, entityType: 'task' } }
        );
      } catch (err) {
        logger.warn('Mention notification failed', { mentionedId: mid, error: err.message });
      }
    }
  }
  return out;
}

module.exports = {
  canAccessTask,
  listMessages,
  createMessage
};
