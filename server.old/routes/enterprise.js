// Enterprise Routes
// Granular roles/permissions, workspaces, audit logs, compliance, SLAs

const express = require('express');
const auth = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess, sendError } = require('../utils/response');
const {
  createWorkspace,
  addWorkspaceMember,
  updateMemberPermissions,
  checkPermission,
  getUserWorkspaces,
  getAuditLogs,
  configureDataResidency,
  configureSLA
} = require('../services/workspaceService');
const {
  createWorkflowTemplate,
  createDefaultTemplates,
  executeWorkflowTemplate,
  getWorkflowTemplates
} = require('../services/workflowTemplateService');
const {
  exportUserData,
  deleteUserData,
  checkGDPRCompliance,
  getDataResidencyInfo,
  getSLAStatus,
  enforceDataRetention,
  manageConsent,
  getComplianceCertifications,
  routeDataByResidency
} = require('../services/complianceService');
const {
  delegatePermission,
  createWorkspaceFromTemplate,
  getAuditLogAnalytics,
  generateComplianceReport,
  monitorSLA,
  getWorkspaceAnalytics,
  publishTemplateToMarketplace,
  getMarketplaceTemplates
} = require('../services/workspaceService');

const router = express.Router();

/**
 * Workspace Management
 */

/**
 * POST /api/enterprise/workspaces
 * Create workspace
 */
router.post('/workspaces', auth, asyncHandler(async (req, res) => {
  const workspace = await createWorkspace(req.user._id, req.body);
  sendSuccess(res, 'Workspace created', 201, workspace);
}));

/**
 * GET /api/enterprise/workspaces
 * Get user's workspaces
 */
router.get('/workspaces', auth, asyncHandler(async (req, res) => {
  const { type = null } = req.query;
  const workspaces = await getUserWorkspaces(req.user._id, type);
  sendSuccess(res, 'Workspaces retrieved', 200, { workspaces });
}));

/**
 * POST /api/enterprise/workspaces/:workspaceId/members
 * Add member to workspace
 */
router.post('/workspaces/:workspaceId/members', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const workspace = await addWorkspaceMember(workspaceId, req.user._id, req.body, req.user._id);
  sendSuccess(res, 'Member added', 200, workspace);
}));

/**
 * PUT /api/enterprise/workspaces/:workspaceId/members/:memberId/permissions
 * Update member permissions
 */
router.put('/workspaces/:workspaceId/members/:memberId/permissions', auth, asyncHandler(async (req, res) => {
  const { workspaceId, memberId } = req.params;
  const workspace = await updateMemberPermissions(workspaceId, memberId, req.body, req.user._id);
  sendSuccess(res, 'Permissions updated', 200, workspace);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/permissions/check
 * Check user permission
 */
router.get('/workspaces/:workspaceId/permissions/check', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { permission } = req.query;

  if (!permission) {
    return sendError(res, 'Permission is required', 400);
  }

  const hasPermission = await checkPermission(req.user._id, workspaceId, permission);
  sendSuccess(res, 'Permission checked', 200, { hasPermission, permission });
}));

/**
 * Audit Logs
 */

/**
 * GET /api/enterprise/workspaces/:workspaceId/audit-logs
 * Get audit logs
 */
router.get('/workspaces/:workspaceId/audit-logs', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const {
    userId,
    action,
    resourceType,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = req.query;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const logs = await getAuditLogs(workspaceId, {
    userId,
    action,
    resourceType,
    startDate,
    endDate,
    limit,
    offset
  });

  sendSuccess(res, 'Audit logs retrieved', 200, logs);
}));

/**
 * Workflow Templates
 */

/**
 * POST /api/enterprise/workflow-templates
 * Create workflow template
 */
router.post('/workflow-templates', auth, asyncHandler(async (req, res) => {
  const template = await createWorkflowTemplate(req.user._id, req.body);
  sendSuccess(res, 'Template created', 201, template);
}));

/**
 * POST /api/enterprise/workflow-templates/defaults
 * Create default opinionated templates
 */
router.post('/workflow-templates/defaults', auth, asyncHandler(async (req, res) => {
  const templates = await createDefaultTemplates(req.user._id);
  sendSuccess(res, 'Default templates created', 201, { templates });
}));

/**
 * GET /api/enterprise/workflow-templates
 * Get workflow templates
 */
router.get('/workflow-templates', auth, asyncHandler(async (req, res) => {
  const { workspaceId = null, category = null } = req.query;
  const templates = await getWorkflowTemplates(req.user._id, workspaceId, category);
  sendSuccess(res, 'Templates retrieved', 200, { templates });
}));

/**
 * POST /api/enterprise/workflow-templates/:templateId/execute
 * Execute workflow template
 */
router.post('/workflow-templates/:templateId/execute', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { contentId, workspaceId, ...options } = req.body;

  if (!contentId) {
    return sendError(res, 'Content ID is required', 400);
  }

  const execution = await executeWorkflowTemplate(req.user._id, workspaceId, templateId, contentId, options);
  sendSuccess(res, 'Workflow executed', 200, execution);
}));

/**
 * Compliance & Data Residency
 */

/**
 * GET /api/enterprise/compliance/gdpr/export
 * Export user data (GDPR)
 */
router.get('/compliance/gdpr/export', auth, asyncHandler(async (req, res) => {
  const exportData = await exportUserData(req.user._id);
  sendSuccess(res, 'Data exported', 200, exportData);
}));

/**
 * DELETE /api/enterprise/compliance/gdpr/delete
 * Delete user data (GDPR - Right to be forgotten)
 */
router.delete('/compliance/gdpr/delete', auth, asyncHandler(async (req, res) => {
  const result = await deleteUserData(req.user._id);
  sendSuccess(res, 'Data deleted', 200, result);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/compliance/gdpr
 * Check GDPR compliance
 */
router.get('/workspaces/:workspaceId/compliance/gdpr', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const compliance = await checkGDPRCompliance(workspaceId);
  sendSuccess(res, 'GDPR compliance checked', 200, compliance);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/data-residency
 * Get data residency information
 */
router.get('/workspaces/:workspaceId/data-residency', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const residency = await getDataResidencyInfo(workspaceId);
  sendSuccess(res, 'Data residency info retrieved', 200, residency);
}));

/**
 * PUT /api/enterprise/workspaces/:workspaceId/data-residency
 * Configure data residency
 */
router.put('/workspaces/:workspaceId/data-residency', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const workspace = await configureDataResidency(workspaceId, req.body, req.user._id);
  sendSuccess(res, 'Data residency configured', 200, workspace);
}));

/**
 * SLA Management
 */

/**
 * GET /api/enterprise/workspaces/:workspaceId/sla
 * Get SLA status
 */
router.get('/workspaces/:workspaceId/sla', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const sla = await getSLAStatus(workspaceId);
  sendSuccess(res, 'SLA status retrieved', 200, sla);
}));

/**
 * PUT /api/enterprise/workspaces/:workspaceId/sla
 * Configure SLA
 */
router.put('/workspaces/:workspaceId/sla', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  
  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const workspace = await configureSLA(workspaceId, req.body, req.user._id);
  sendSuccess(res, 'SLA configured', 200, workspace);
}));

/**
 * POST /api/enterprise/workspaces/:workspaceId/members/:memberId/delegate
 * Delegate permissions
 */
router.post('/workspaces/:workspaceId/members/:memberId/delegate', auth, asyncHandler(async (req, res) => {
  const { workspaceId, memberId } = req.params;
  const { permissions } = req.body;

  if (!permissions || !Array.isArray(permissions)) {
    return sendError(res, 'Permissions array is required', 400);
  }

  const workspace = await delegatePermission(req.user._id, workspaceId, memberId, permissions, req.user._id);
  sendSuccess(res, 'Permissions delegated', 200, workspace);
}));

/**
 * POST /api/enterprise/workspaces/from-template
 * Create workspace from template
 */
router.post('/workspaces/from-template', auth, asyncHandler(async (req, res) => {
  const { templateName, ...workspaceData } = req.body;

  if (!templateName) {
    return sendError(res, 'Template name is required', 400);
  }

  const workspace = await createWorkspaceFromTemplate(req.user._id, templateName, workspaceData);
  sendSuccess(res, 'Workspace created from template', 201, workspace);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/audit-logs/analytics
 * Get audit log analytics
 */
router.get('/workspaces/:workspaceId/audit-logs/analytics', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { timeframe = '30days' } = req.query;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const analytics = await getAuditLogAnalytics(workspaceId, timeframe);
  sendSuccess(res, 'Audit log analytics retrieved', 200, analytics);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/compliance/report
 * Generate compliance report
 */
router.get('/workspaces/:workspaceId/compliance/report', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { reportType = 'gdpr' } = req.query;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const report = await generateComplianceReport(workspaceId, reportType);
  sendSuccess(res, 'Compliance report generated', 200, report);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/sla/monitor
 * Monitor SLA and get alerts
 */
router.get('/workspaces/:workspaceId/sla/monitor', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const monitoring = await monitorSLA(workspaceId);
  sendSuccess(res, 'SLA monitoring completed', 200, monitoring);
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/analytics
 * Get workspace analytics
 */
router.get('/workspaces/:workspaceId/analytics', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { timeframe = '30days' } = req.query;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const analytics = await getWorkspaceAnalytics(workspaceId, timeframe);
  sendSuccess(res, 'Workspace analytics retrieved', 200, analytics);
}));

/**
 * POST /api/enterprise/workflow-templates/:templateId/publish
 * Publish template to marketplace
 */
router.post('/workflow-templates/:templateId/publish', auth, asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await publishTemplateToMarketplace(templateId, req.user._id);
  sendSuccess(res, 'Template published to marketplace', 200, template);
}));

/**
 * GET /api/enterprise/workflow-templates/marketplace
 * Get marketplace templates
 */
router.get('/workflow-templates/marketplace', auth, asyncHandler(async (req, res) => {
  const { category = null, limit = 20 } = req.query;
  const templates = await getMarketplaceTemplates(category, parseInt(limit));
  sendSuccess(res, 'Marketplace templates retrieved', 200, { templates });
}));

/**
 * POST /api/enterprise/compliance/retention/enforce
 * Enforce data retention policy
 */
router.post('/compliance/retention/enforce', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.body;

  if (!workspaceId) {
    return sendError(res, 'Workspace ID is required', 400);
  }

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const results = await enforceDataRetention(workspaceId);
  sendSuccess(res, 'Data retention enforced', 200, results);
}));

/**
 * POST /api/enterprise/compliance/consent
 * Manage user consent
 */
router.post('/compliance/consent', auth, asyncHandler(async (req, res) => {
  const { consentType, granted } = req.body;

  if (!consentType || typeof granted !== 'boolean') {
    return sendError(res, 'Consent type and granted status are required', 400);
  }

  const consent = await manageConsent(req.user._id, consentType, granted);
  sendSuccess(res, 'Consent managed', 200, { consent });
}));

/**
 * GET /api/enterprise/workspaces/:workspaceId/compliance/certifications
 * Get compliance certifications
 */
router.get('/workspaces/:workspaceId/compliance/certifications', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canViewAnalytics');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const certifications = await getComplianceCertifications(workspaceId);
  sendSuccess(res, 'Compliance certifications retrieved', 200, certifications);
}));

/**
 * POST /api/enterprise/workspaces/:workspaceId/data-routing
 * Route data by residency
 */
router.post('/workspaces/:workspaceId/data-routing', auth, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const { dataType, data } = req.body;

  // Check permission
  const hasPermission = await checkPermission(req.user._id, workspaceId, 'canManageSettings');
  if (!hasPermission) {
    return sendError(res, 'Insufficient permissions', 403);
  }

  const routing = await routeDataByResidency(workspaceId, dataType, data);
  sendSuccess(res, 'Data routed by residency', 200, routing);
}));

module.exports = router;

