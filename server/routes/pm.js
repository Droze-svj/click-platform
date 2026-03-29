// Project Management API — projects, milestones, dependencies, critical path, AI prediction, automation

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const pmProjectService = require('../services/pmProjectService');

const router = express.Router();

function getUserId(req) {
  return req.user?.id ?? req.user?._id;
}

router.get('/projects', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const { status } = req.query;
  const projects = await pmProjectService.listProjects(userId, { status: status || undefined });
  sendSuccess(res, 'Projects fetched', 200, { projects });
}));

router.get('/projects/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const project = await pmProjectService.getProject(userId, req.params.id);
  if (!project) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Project fetched', 200, project);
}));

router.get('/projects/:id/dashboard', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const dashboard = await pmProjectService.getDashboard(userId, req.params.id);
  if (!dashboard) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Dashboard fetched', 200, dashboard);
}));

router.post('/projects', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const project = await pmProjectService.createProject(userId, req.body || {});
  sendSuccess(res, 'Project created', 201, project);
}));

router.put('/projects/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const project = await pmProjectService.updateProject(userId, req.params.id, req.body || {});
  if (!project) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Project updated', 200, project);
}));

router.delete('/projects/:id', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const result = await pmProjectService.deleteProject(userId, req.params.id);
  if (!result) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Project deleted', 200, result);
}));

router.post('/projects/:id/milestones', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const milestone = await pmProjectService.addMilestone(userId, req.params.id, req.body || {});
  if (!milestone) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Milestone added', 201, milestone);
}));

router.put('/projects/:projectId/milestones/:milestoneId', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const milestone = await pmProjectService.updateMilestone(userId, req.params.projectId, req.params.milestoneId, req.body || {});
  if (!milestone) return sendError(res, 'Project or milestone not found', 404);
  sendSuccess(res, 'Milestone updated', 200, milestone);
}));

router.post('/projects/:projectId/milestones/:milestoneId/complete', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const milestone = await pmProjectService.completeMilestone(userId, req.params.projectId, req.params.milestoneId);
  if (!milestone) return sendError(res, 'Project or milestone not found', 404);
  sendSuccess(res, 'Milestone completed', 200, milestone);
}));

router.delete('/projects/:projectId/milestones/:milestoneId', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const result = await pmProjectService.deleteMilestone(userId, req.params.projectId, req.params.milestoneId);
  if (!result) return sendError(res, 'Project or milestone not found', 404);
  sendSuccess(res, 'Milestone deleted', 200, result);
}));

router.post('/projects/:id/predict', auth, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  if (!userId) return sendError(res, 'Unauthorized', 401);
  const result = await pmProjectService.runPrediction(userId, req.params.id);
  if (!result) return sendError(res, 'Project not found', 404);
  sendSuccess(res, 'Prediction updated', 200, result);
}));

module.exports = router;
