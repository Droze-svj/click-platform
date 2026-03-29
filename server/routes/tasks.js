// Task management API — CRUD, reorder, AI sort, supports Kanban/Gantt/list

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const taskService = require('../services/taskService');
const taskMessageService = require('../services/taskMessageService');
const logger = require('../utils/logger');

const router = express.Router();

function getUserId(req) {
  return req.user?.id ?? req.user?._id;
}

// Task chat (define before /:id so /:taskId/messages matches)
router.get('/:taskId/messages', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const messages = await taskMessageService.listMessages(req.params.taskId, userId);
  sendSuccess(res, 'Messages fetched', 200, { messages });
}));

router.post('/:taskId/messages', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const { body, mentionUserIds } = req.body || {};
  const message = await taskMessageService.createMessage(req.params.taskId, userId, { body, mentionUserIds });
  if (!message) return sendError(res, 'Task not found or access denied', 404);
  sendSuccess(res, 'Message sent', 201, message);
}));

const taskCallService = require('../services/taskCallService');

router.get('/:taskId/call', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const call = await taskCallService.getActiveCall(req.params.taskId, userId);
  sendSuccess(res, 'Call status', 200, call || { active: false });
}));

router.post('/:taskId/call/start', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const call = await taskCallService.startCall(req.params.taskId, userId);
  if (!call) return sendError(res, 'Task not found or access denied', 404);
  sendSuccess(res, 'Call started', 201, call);
}));

router.post('/:taskId/call/end', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const { roomId } = req.body || {};
  const result = await taskCallService.endCall(req.params.taskId, roomId, userId);
  if (!result) return sendError(res, 'Call not found or access denied', 404);
  sendSuccess(res, 'Call ended', 200, result);
}));

router.get('/', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const { parentId, includeSubtasks, status, view, sortByUrgency } = req.query;
  const tasks = await taskService.listTasks(userId, {
    parentId: parentId || undefined,
    includeSubtasks: includeSubtasks === 'true' || includeSubtasks === '1',
    status: status || undefined,
    view: view || 'list',
    sortByUrgency: sortByUrgency === 'true' || sortByUrgency === '1'
  });
  sendSuccess(res, 'Tasks fetched', 200, { tasks });
}));

router.get('/meta', auth, asyncHandler(async (req, res) => {
  sendSuccess(res, 'Task meta', 200, {
    statuses: taskService.TASK_STATUSES,
    priorities: taskService.PRIORITIES
  });
}));

router.get('/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const task = await taskService.getTask(userId, req.params.id);
  if (!task) return sendError(res, 'Task not found', 404);
  sendSuccess(res, 'Task fetched', 200, task);
}));

router.post('/', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const task = await taskService.createTask(userId, req.body || {});
  sendSuccess(res, 'Task created', 201, task);
}));

router.put('/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const task = await taskService.updateTask(userId, req.params.id, req.body || {});
  if (!task) return sendError(res, 'Task not found', 404);
  sendSuccess(res, 'Task updated', 200, task);
}));

router.delete('/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const result = await taskService.deleteTask(userId, req.params.id);
  if (!result) return sendError(res, 'Task not found', 404);
  sendSuccess(res, 'Task deleted', 200, result);
}));

router.post('/reorder', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const { taskIds } = req.body || {};
  if (!Array.isArray(taskIds)) return sendError(res, 'taskIds array required', 400);
  await taskService.reorderTasks(userId, taskIds);
  sendSuccess(res, 'Tasks reordered', 200, { reordered: true });
}));

router.post('/recompute-urgency', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const result = await taskService.recomputeUrgency(userId);
  sendSuccess(res, 'Urgency recomputed', 200, result);
}));

module.exports = router;
