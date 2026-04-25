// In-task video/audio calls; WebRTC signaling over socket

const Task = require('../models/Task');
const TaskCall = require('../models/TaskCall');
const taskMessageService = require('./taskMessageService');
const logger = require('../utils/logger');

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

/**
 * Start a call for a task. Returns roomId for WebRTC signaling room (call:roomId).
 */
async function startCall(taskId, userId) {
  const { allowed } = await taskMessageService.canAccessTask(userId, taskId);
  if (!allowed) return null;
  const task = await Task.findOne({ _id: taskId }).lean();
  if (!task) return null;
  const call = new TaskCall({
    taskId,
    startedBy: normalizeUserId(userId)
  });
  await call.save();
  return {
    roomId: call.roomId,
    taskId: call.taskId.toString(),
    startedAt: call.startedAt
  };
}

/**
 * End a call (optional; client can just leave).
 */
async function endCall(taskId, roomId, userId) {
  const { allowed } = await taskMessageService.canAccessTask(userId, taskId);
  if (!allowed) return null;
  const call = await TaskCall.findOne({ taskId, roomId }).lean();
  if (!call) return null;
  await TaskCall.updateOne({ _id: call._id }, { $set: { endedAt: new Date() } });
  return { ended: true };
}

/**
 * Get active call for task if any.
 */
async function getActiveCall(taskId, userId) {
  const { allowed } = await taskMessageService.canAccessTask(userId, taskId);
  if (!allowed) return null;
  const call = await TaskCall.findOne({ taskId, endedAt: null }).sort({ startedAt: -1 }).lean();
  return call;
}

module.exports = {
  startCall,
  endCall,
  getActiveCall
};
