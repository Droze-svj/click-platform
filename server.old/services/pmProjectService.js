// PM projects: dependencies, critical path, AI progress prediction, back-office automation

const PmProject = require('../models/PmProject');
const logger = require('../utils/logger');
const notificationService = require('./notificationService');

function normalizeUserId(userId) {
  return userId != null && typeof userId === 'object' && userId.toString
    ? userId.toString()
    : String(userId);
}

/**
 * Topological sort of milestone ids by dependencies (dependency first).
 */
function topologicalSort(milestones) {
  const idToM = new Map();
  milestones.forEach((m) => idToM.set(m._id.toString(), m));
  const visited = new Set();
  const result = [];
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const m = idToM.get(id);
    if (m && m.dependencyMilestoneIds) {
      m.dependencyMilestoneIds.forEach((depId) => visit(depId.toString()));
    }
    result.push(id);
  }
  milestones.forEach((m) => visit(m._id.toString()));
  return result;
}

/**
 * Compute longest path (critical path) from start to each milestone. Returns map: milestoneId -> { earliestStart, earliestFinish, isOnCriticalPath }.
 * Duration = estimatedDays; dependencies constrain earliest start.
 */
function computeCriticalPath(milestones) {
  const idToM = new Map();
  milestones.forEach((m) => idToM.set(m._id.toString(), m));
  const order = topologicalSort(milestones);
  const earliestStart = new Map();
  const earliestFinish = new Map();
  order.forEach((id) => {
    const m = idToM.get(id);
    if (!m) return;
    const duration = Math.max(0, m.estimatedDays ?? 1);
    let start = 0;
    if (m.dependencyMilestoneIds && m.dependencyMilestoneIds.length) {
      m.dependencyMilestoneIds.forEach((depId) => {
        const fin = earliestFinish.get(depId.toString());
        if (fin != null && fin > start) start = fin;
      });
    }
    earliestStart.set(id, start);
    earliestFinish.set(id, start + duration);
  });
  const maxFinish = Math.max(...Array.from(earliestFinish.values()), 0);
  const criticalPathIds = new Set();
  order.slice().reverse().forEach((id) => {
    const m = idToM.get(id);
    if (!m) return;
    const finish = earliestFinish.get(id);
    const isEnd = !milestones.some((other) =>
      other.dependencyMilestoneIds?.some((d) => d.toString() === id)
    );
    if (isEnd && finish >= maxFinish - 0.001) {
      criticalPathIds.add(id);
      let current = id;
      for (;;) {
        const currM = idToM.get(current);
        if (!currM?.dependencyMilestoneIds?.length) break;
        let latestPred = -1;
        let predId = null;
        currM.dependencyMilestoneIds.forEach((d) => {
          const es = earliestStart.get(d.toString());
          if (es != null && es > latestPred) {
            latestPred = es;
            predId = d.toString();
          }
        });
        if (predId == null) break;
        criticalPathIds.add(predId);
        current = predId;
      }
    }
  });
  const pathInfo = {};
  order.forEach((id) => {
    pathInfo[id] = {
      earliestStart: earliestStart.get(id) ?? 0,
      earliestFinish: earliestFinish.get(id) ?? 0,
      isOnCriticalPath: criticalPathIds.has(id)
    };
  });
  return { pathInfo, totalDays: maxFinish };
}

/**
 * Recompute and persist project progress from milestones.
 */
function computeProgress(milestones) {
  if (!milestones.length) return 0;
  const done = milestones.filter((m) => m.completedAt).length;
  return Math.round((done / milestones.length) * 100);
}

/**
 * AI-style prediction: use velocity (completed per day) to predict completion.
 */
function predictCompletion(project, milestones) {
  const done = milestones.filter((m) => m.completedAt).length;
  const total = milestones.length;
  if (total === 0) return { predictedDate: null, confidence: 0 };
  if (done >= total) {
    const lastCompleted = milestones
      .filter((m) => m.completedAt)
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
    return {
      predictedDate: lastCompleted?.completedAt ?? new Date(),
      confidence: 1
    };
  }
  const start = project.startDate ? new Date(project.startDate) : new Date(project.createdAt);
  const now = new Date();
  const elapsedDays = Math.max(0.1, (now - start) / (24 * 60 * 60 * 1000));
  const velocity = done / elapsedDays;
  if (velocity <= 0) {
    const { totalDays } = computeCriticalPath(milestones);
    const predicted = new Date(now);
    predicted.setDate(predicted.getDate() + Math.ceil(totalDays));
    return { predictedDate: predicted, confidence: 0.3 };
  }
  const remaining = total - done;
  const daysToComplete = remaining / velocity;
  const predicted = new Date(now);
  predicted.setDate(predicted.getDate() + Math.ceil(daysToComplete));
  const confidence = Math.min(0.95, 0.4 + 0.2 * Math.log(1 + done));
  return { predictedDate: predicted, confidence };
}

async function runMilestoneAutomation(userId, project, milestone) {
  const auto = milestone.automation;
  if (!auto || auto.onComplete === 'none') return;
  const uid = normalizeUserId(userId);
  try {
    if (auto.onComplete === 'generate_report' && auto.config?.reportTemplateId) {
      const reportBuilderService = require('./reportBuilderService');
      const period = { start: new Date(new Date().getFullYear(), new Date().getMonth(), 1), end: new Date() };
      await reportBuilderService.generateReport(
        auto.config.reportTemplateId,
        period,
        project.workspaceId || null,
        null,
        uid
      );
      logger.info('PM milestone report generated', { projectId: project._id, milestoneId: milestone._id });
    }
    if (auto.onComplete === 'run_workflow' && auto.config?.workflowId) {
      const workflowService = require('./workflowService');
      await workflowService.executeWorkflow(auto.config.workflowId, uid, {
        trigger: 'pm_milestone',
        projectId: project._id.toString(),
        milestoneId: milestone._id.toString(),
        milestoneTitle: milestone.title
      });
      logger.info('PM milestone workflow executed', { projectId: project._id, milestoneId: milestone._id });
    }
  } catch (err) {
    logger.warn('PM milestone automation failed', { error: err.message, milestoneId: milestone._id });
  }
}

async function listProjects(userId, filters = {}) {
  const uid = normalizeUserId(userId);
  const query = { userId: uid };
  if (filters.status) query.status = filters.status;
  const projects = await PmProject.find(query).sort({ updatedAt: -1 }).lean();
  return projects;
}

async function getProject(userId, projectId) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid }).lean();
  return project;
}

async function getDashboard(userId, projectId) {
  const project = await getProject(userId, projectId);
  if (!project) return null;
  const milestones = project.milestones || [];
  const { pathInfo, totalDays } = computeCriticalPath(milestones);
  const prediction = predictCompletion(project, milestones);
  return {
    ...project,
    criticalPath: pathInfo,
    criticalPathTotalDays: totalDays,
    aiPredictedCompletionDate: prediction.predictedDate,
    aiPredictionConfidence: prediction.confidence,
    milestones: milestones.map((m) => ({
      ...m,
      _id: m._id,
      criticalPathInfo: pathInfo[m._id.toString()]
    }))
  };
}

async function createProject(userId, data) {
  const uid = normalizeUserId(userId);
  const project = new PmProject({
    userId: uid,
    name: data.name || 'Untitled project',
    description: data.description ?? '',
    status: data.status || 'planning',
    startDate: data.startDate ?? null,
    targetEndDate: data.targetEndDate ?? null,
    workspaceId: data.workspaceId ?? null,
    milestones: data.milestones || []
  });
  await project.save();
  return project.toObject();
}

async function updateProject(userId, projectId, data) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid });
  if (!project) return null;
  const allowed = ['name', 'description', 'status', 'startDate', 'targetEndDate', 'workspaceId', 'milestones'];
  allowed.forEach((k) => { if (data[k] !== undefined) project[k] = data[k]; });
  project.progress = computeProgress(project.milestones);
  await project.save();
  return project.toObject();
}

async function addMilestone(userId, projectId, milestoneData) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid });
  if (!project) return null;
  project.milestones.push({
    title: milestoneData.title || 'Milestone',
    description: milestoneData.description ?? '',
    dueDate: milestoneData.dueDate ?? null,
    dependencyMilestoneIds: milestoneData.dependencyMilestoneIds || [],
    estimatedDays: milestoneData.estimatedDays ?? 1,
    order: (project.milestones.length + 1) * 10,
    linkedTaskId: milestoneData.linkedTaskId ?? null,
    linkedContentId: milestoneData.linkedContentId ?? null,
    linkedWorkflowId: milestoneData.linkedWorkflowId ?? null,
    automation: milestoneData.automation || { onComplete: 'none', config: {} }
  });
  await project.save();
  const added = project.milestones[project.milestones.length - 1];
  return added.toObject();
}

async function updateMilestone(userId, projectId, milestoneId, updates) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid });
  if (!project) return null;
  const m = project.milestones.id(milestoneId);
  if (!m) return null;
  const allowed = ['title', 'description', 'dueDate', 'dependencyMilestoneIds', 'estimatedDays', 'order', 'linkedTaskId', 'linkedContentId', 'linkedWorkflowId', 'automation'];
  allowed.forEach((k) => { if (updates[k] !== undefined) m[k] = updates[k]; });
  project.progress = computeProgress(project.milestones);
  await project.save();
  return m.toObject();
}

async function completeMilestone(userId, projectId, milestoneId) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid });
  if (!project) return null;
  const m = project.milestones.id(milestoneId);
  if (!m) return null;
  if (m.completedAt) return m.toObject();
  m.completedAt = new Date();
  project.progress = computeProgress(project.milestones);
  await project.save();
  await runMilestoneAutomation(uid, project, m);

  const next = (project.milestones || []).find((mil) => !mil.completedAt);
  try {
    await notificationService.createNotificationForChange(uid, 'milestone_completed', {
      entityName: m.title,
      projectId: projectId.toString(),
      link: `/dashboard/projects?open=${projectId}`,
      nextMilestone: next ? next.title : null
    });
  } catch (err) {
    logger.warn('Milestone completion notification failed', { error: err.message, milestoneId });
  }

  return m.toObject();
}

async function deleteMilestone(userId, projectId, milestoneId) {
  const uid = normalizeUserId(userId);
  const project = await PmProject.findOne({ _id: projectId, userId: uid });
  if (!project) return null;
  project.milestones.pull(milestoneId);
  project.progress = computeProgress(project.milestones);
  await project.save();
  return { deleted: true };
}

async function runPrediction(userId, projectId) {
  const project = await getProject(userId, projectId);
  if (!project) return null;
  const milestones = project.milestones || [];
  const { predictedDate, confidence } = predictCompletion(project, milestones);
  await PmProject.updateOne(
    { _id: projectId, userId: normalizeUserId(userId) },
    {
      $set: {
        aiPredictedCompletionDate: predictedDate,
        aiPredictionConfidence: confidence,
        lastPredictionAt: new Date()
      }
    }
  );
  return { predictedDate, confidence };
}

async function deleteProject(userId, projectId) {
  const uid = normalizeUserId(userId);
  const result = await PmProject.findOneAndDelete({ _id: projectId, userId: uid });
  return result ? { deleted: true } : null;
}

module.exports = {
  listProjects,
  getProject,
  getDashboard,
  createProject,
  updateProject,
  addMilestone,
  updateMilestone,
  completeMilestone,
  deleteMilestone,
  runPrediction,
  deleteProject,
  computeCriticalPath,
  computeProgress,
  predictCompletion
};
