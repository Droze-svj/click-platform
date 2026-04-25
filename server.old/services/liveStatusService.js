// Live status feed — in-progress tasks (and jobs) for persistent real-time badges

const Task = require('../models/Task');
const logger = require('../utils/logger');

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

/**
 * Get current in-progress items for the user (tasks with status in_progress or review).
 */
async function getLiveStatus(userId) {
  const uid = normalizeUserId(userId);
  try {
    const inProgressTasks = await Task.find({
      userId: uid,
      status: { $in: ['in_progress', 'review'] },
      parentId: null
    })
      .select('_id title status dueDate updatedAt')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const tasks = inProgressTasks.map((t) => ({
      id: t._id.toString(),
      title: t.title,
      status: t.status,
      dueDate: t.dueDate,
      updatedAt: t.updatedAt,
      type: 'task'
    }));

    return { tasks };
  } catch (error) {
    logger.warn('Live status fetch failed', { userId: uid, error: error.message });
    return { tasks: [] };
  }
}

module.exports = {
  getLiveStatus
};
