// Task service — CRUD, unlimited subtasks, AI-style urgency scoring, WebSocket emit

const Task = require('../models/Task');
const { TASK_STATUSES, PRIORITIES } = require('../models/Task');
const { emitToUser } = require('./socketService');
const logger = require('../utils/logger');

const PRIORITY_WEIGHT = { low: 15, medium: 40, high: 70, urgent: 95 };

/**
 * Compute urgency score from priority, due date, and status (AI auto-sort).
 * Returns 0–100; higher = more urgent.
 */
function computeUrgencyScore(task) {
  let score = PRIORITY_WEIGHT[task.priority] ?? 40;
  if (task.status === 'done') return 0;
  if (task.dueDate) {
    const now = new Date();
    const due = new Date(task.dueDate);
    const daysUntil = (due - now) / (24 * 60 * 60 * 1000);
    if (daysUntil < 0) score = Math.min(100, score + 30);
    else if (daysUntil <= 1) score = Math.min(100, score + 25);
    else if (daysUntil <= 3) score = Math.min(100, score + 15);
    else if (daysUntil <= 7) score = Math.min(100, score + 5);
  }
  return Math.round(Math.min(100, score));
}

/**
 * Get userId string for socket/query (supports ObjectId and string)
 */
function normalizeUserId(userId) {
  return userId && typeof userId === 'object' && userId.toString ? userId.toString() : String(userId);
}

function emitTaskUpdate(userId, event, payload) {
  try {
    emitToUser(normalizeUserId(userId), event, payload);
  } catch (e) {
    logger.warn('Task WebSocket emit failed', { userId, error: e.message });
  }
}

async function listTasks(userId, options = {}) {
  const { parentId, includeSubtasks = false, status, view = 'list', sortByUrgency = false } = options;
  const query = { userId: normalizeUserId(userId) };
  if (!includeSubtasks) query.parentId = parentId ?? null;
  if (status) query.status = status;

  let tasks = await Task.find(query).sort(sortByUrgency ? { urgencyScore: -1, order: 1, createdAt: -1 } : { order: 1, createdAt: -1 }).lean();

  if (sortByUrgency) {
    tasks = tasks.map((t) => ({
      ...t,
      urgencyScore: t.urgencyScore ?? computeUrgencyScore(t)
    }));
    tasks.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0));
  }

  return tasks;
}

async function getTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, userId: normalizeUserId(userId) }).lean();
  if (!task) return null;
  const children = await Task.find({ parentId: taskId, userId: normalizeUserId(userId) }).sort({ order: 1 }).lean();
  return { ...task, subtasks: children };
}

async function createTask(userId, data) {
  const urgencyScore = data.urgencyScore ?? computeUrgencyScore({ ...data, status: data.status || 'todo' });
  const task = new Task({
    userId: normalizeUserId(userId),
    title: data.title || 'Untitled task',
    description: data.description ?? '',
    status: data.status || 'todo',
    priority: data.priority || 'medium',
    dueDate: data.dueDate ?? null,
    startDate: data.startDate ?? null,
    parentId: data.parentId ?? null,
    order: data.order ?? 0,
    listId: data.listId ?? null,
    tags: data.tags || [],
    urgencyScore
  });
  await task.save();
  const out = task.toObject();
  emitTaskUpdate(userId, 'tasks:update', { type: 'created', task: out });
  return out;
}

async function updateTask(userId, taskId, data) {
  const task = await Task.findOne({ _id: taskId, userId: normalizeUserId(userId) });
  if (!task) return null;
  const oldDue = task.dueDate ? new Date(task.dueDate) : null;
  const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'startDate', 'order', 'listId', 'tags'];
  allowed.forEach((k) => { if (data[k] !== undefined) task[k] = data[k]; });
  task.urgencyScore = computeUrgencyScore(task);
  await task.save();
  const out = task.toObject();
  emitTaskUpdate(userId, 'tasks:update', { type: 'updated', task: out });
  emitTaskUpdate(userId, 'live_status:update', { type: 'task', id: taskId, status: task.status });
  if (data.dueDate !== undefined && oldDue && task.dueDate) {
    const newDue = new Date(task.dueDate);
    if (newDue > oldDue) {
      const daysDelayed = Math.ceil((newDue - oldDue) / (24 * 60 * 60 * 1000));
      try {
        const notificationService = require('./notificationService');
        await notificationService.createNotificationForChange(normalizeUserId(userId), 'task_delayed', {
          taskId,
          taskTitle: task.title,
          daysDelayed,
          link: `/dashboard/tasks?open=${taskId}`,
          entityId: taskId,
          entityType: 'task'
        });
      } catch (err) {
        logger.warn('Task delayed notification failed', { taskId, error: err.message });
      }
    }
  }
  return out;
}

async function deleteTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, userId: normalizeUserId(userId) });
  if (!task) return null;
  await Task.deleteMany({ userId: normalizeUserId(userId), parentId: taskId });
  await Task.deleteOne({ _id: taskId, userId: normalizeUserId(userId) });
  emitTaskUpdate(userId, 'tasks:update', { type: 'deleted', taskId: task._id.toString() });
  return { deleted: true, taskId };
}

async function reorderTasks(userId, taskIdsInOrder) {
  const ops = taskIdsInOrder.map((id, index) => ({
    updateOne: { filter: { _id: id, userId: normalizeUserId(userId) }, update: { $set: { order: index, updatedAt: new Date() } } }
  }));
  if (ops.length) await Task.bulkWrite(ops);
  emitTaskUpdate(userId, 'tasks:update', { type: 'reordered', taskIds: taskIdsInOrder });
  return { reordered: true };
}

async function recomputeUrgency(userId) {
  const tasks = await Task.find({ userId: normalizeUserId(userId) }).lean();
  for (const t of tasks) {
    const score = computeUrgencyScore(t);
    await Task.updateOne({ _id: t._id }, { $set: { urgencyScore: score, updatedAt: new Date() } });
  }
  emitTaskUpdate(userId, 'tasks:update', { type: 'urgency_recomputed' });
  return { updated: tasks.length };
}

module.exports = {
  listTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  recomputeUrgency,
  computeUrgencyScore,
  TASK_STATUSES,
  PRIORITIES
};
