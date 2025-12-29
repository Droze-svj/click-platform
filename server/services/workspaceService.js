// Workspace Service
// Multi-brand/multi-client workspace management

const Workspace = require('../models/Workspace');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const logger = require('../utils/logger');

/**
 * Create workspace
 */
async function createWorkspace(userId, workspaceData) {
  try {
    const {
      name,
      type = 'team',
      settings = {},
      metadata = {}
    } = workspaceData;

    const workspace = new Workspace({
      name,
      type,
      ownerId: userId,
      members: [{
        userId,
        role: 'owner',
        permissions: getDefaultPermissions('owner'),
        status: 'active',
        joinedAt: new Date()
      }],
      settings: {
        branding: settings.branding || {},
        dataResidency: settings.dataResidency || {
          region: 'global',
          compliance: { gdpr: false, ccpa: false, hipaa: false }
        },
        sla: settings.sla || {
          uptime: 99.9,
          responseTime: 200,
          supportResponse: 4,
          dataRetention: 365
        },
        features: settings.features || {
          approvals: true,
          workflows: true,
          analytics: true,
          apiAccess: false
        }
      },
      metadata
    });

    await workspace.save();

    // Log audit
    await logAudit(userId, 'workspace_created', 'workspace', workspace._id, {
      workspaceName: name,
      workspaceType: type
    }, workspaceId = workspace._id);

    logger.info('Workspace created', { userId, workspaceId: workspace._id, type });
    return workspace;
  } catch (error) {
    logger.error('Error creating workspace', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get default permissions for role
 */
function getDefaultPermissions(role) {
  const permissions = {
    owner: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPublish: true,
      canSchedule: true,
      canManageMembers: true,
      canManageSettings: true,
      canViewAnalytics: true,
      canExportData: true,
      canApprove: true,
      canReject: true,
      canRequestChanges: true,
      canManageWorkflows: true,
      canManageIntegrations: true,
      canAccessAPI: true,
      canManageBilling: true
    },
    admin: {
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canPublish: true,
      canSchedule: true,
      canManageMembers: true,
      canManageSettings: true,
      canViewAnalytics: true,
      canExportData: true,
      canApprove: true,
      canReject: true,
      canRequestChanges: true,
      canManageWorkflows: true,
      canManageIntegrations: true,
      canAccessAPI: false,
      canManageBilling: false
    },
    editor: {
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPublish: false,
      canSchedule: true,
      canManageMembers: false,
      canManageSettings: false,
      canViewAnalytics: true,
      canExportData: false,
      canApprove: false,
      canReject: false,
      canRequestChanges: true,
      canManageWorkflows: false,
      canManageIntegrations: false,
      canAccessAPI: false,
      canManageBilling: false
    },
    approver: {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canPublish: false,
      canSchedule: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewAnalytics: true,
      canExportData: false,
      canApprove: true,
      canReject: true,
      canRequestChanges: true,
      canManageWorkflows: false,
      canManageIntegrations: false,
      canAccessAPI: false,
      canManageBilling: false
    },
    contributor: {
      canCreate: true,
      canEdit: true,
      canDelete: false,
      canPublish: false,
      canSchedule: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewAnalytics: true,
      canExportData: false,
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
      canManageWorkflows: false,
      canManageIntegrations: false,
      canAccessAPI: false,
      canManageBilling: false
    },
    viewer: {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canPublish: false,
      canSchedule: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewAnalytics: true,
      canExportData: false,
      canApprove: false,
      canReject: false,
      canRequestChanges: false,
      canManageWorkflows: false,
      canManageIntegrations: false,
      canAccessAPI: false,
      canManageBilling: false
    }
  };

  return permissions[role] || permissions.viewer;
}

/**
 * Add member to workspace
 */
async function addWorkspaceMember(workspaceId, userId, memberData, addedBy) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    const adder = workspace.members.find(m => m.userId.toString() === addedBy.toString());
    if (!adder || !adder.permissions.canManageMembers) {
      throw new Error('Insufficient permissions to add members');
    }

    const {
      userId: newMemberId,
      role = 'viewer',
      permissions = null
    } = memberData;

    // Check if already a member
    const existingMember = workspace.members.find(m => m.userId.toString() === newMemberId.toString());
    if (existingMember) {
      throw new Error('User is already a member');
    }

    workspace.members.push({
      userId: newMemberId,
      role,
      permissions: permissions || getDefaultPermissions(role),
      status: 'invited',
      invitedAt: new Date()
    });

    await workspace.save();

    // Log audit
    await logAudit(addedBy, 'member_added', 'workspace', workspaceId, {
      memberId: newMemberId,
      role
    }, workspaceId);

    logger.info('Member added to workspace', { workspaceId, memberId: newMemberId, role });
    return workspace;
  } catch (error) {
    logger.error('Error adding workspace member', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Update member permissions
 */
async function updateMemberPermissions(workspaceId, memberId, permissions, updatedBy) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    const updater = workspace.members.find(m => m.userId.toString() === updatedBy.toString());
    if (!updater || !updater.permissions.canManageMembers) {
      throw new Error('Insufficient permissions');
    }

    const member = workspace.members.find(m => m.userId.toString() === memberId.toString());
    if (!member) {
      throw new Error('Member not found');
    }

    const oldPermissions = JSON.parse(JSON.stringify(member.permissions));
    member.permissions = { ...member.permissions, ...permissions };
    await workspace.save();

    // Log audit
    await logAudit(updatedBy, 'permissions_updated', 'workspace', workspaceId, {
      memberId,
      before: oldPermissions,
      after: member.permissions
    }, workspaceId);

    logger.info('Member permissions updated', { workspaceId, memberId });
    return workspace;
  } catch (error) {
    logger.error('Error updating member permissions', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Check user permission
 */
async function checkPermission(userId, workspaceId, permission) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return false;
    }

    const member = workspace.members.find(m => m.userId.toString() === userId.toString());
    if (!member || member.status !== 'active') {
      return false;
    }

    return member.permissions[permission] || false;
  } catch (error) {
    logger.error('Error checking permission', { error: error.message, userId, workspaceId });
    return false;
  }
}

/**
 * Get user workspaces
 */
async function getUserWorkspaces(userId, type = null) {
  try {
    const query = {
      'members.userId': userId,
      'members.status': 'active',
      isActive: true
    };

    if (type) {
      query.type = type;
    }

    const workspaces = await Workspace.find(query).lean();
    return workspaces.map(ws => {
      const member = ws.members.find(m => m.userId.toString() === userId.toString());
      return {
        ...ws,
        userRole: member?.role,
        userPermissions: member?.permissions
      };
    });
  } catch (error) {
    logger.error('Error getting user workspaces', { error: error.message, userId });
    throw error;
  }
}

/**
 * Log audit event
 */
async function logAudit(userId, action, resourceType, resourceId, details = {}, workspaceId = null, metadata = {}) {
  try {
    const auditLog = new AuditLog({
      workspaceId,
      userId,
      action,
      resourceType,
      resourceId,
      details: {
        ...details
      },
      metadata: {
        ipAddress: metadata.ipAddress || null,
        userAgent: metadata.userAgent || null,
        location: metadata.location || null,
        device: metadata.device || null
      },
      compliance: {
        gdprRelevant: resourceType === 'user' || action.includes('data'),
        dataCategory: determineDataCategory(resourceType, action)
      }
    });

    await auditLog.save();
    return auditLog;
  } catch (error) {
    logger.error('Error logging audit', { error: error.message });
    // Don't throw - audit logging should not break main flow
  }
}

/**
 * Determine data category for compliance
 */
function determineDataCategory(resourceType, action) {
  if (resourceType === 'user' || action.includes('personal')) {
    return 'personal';
  }
  if (action.includes('sensitive') || action.includes('password')) {
    return 'sensitive';
  }
  if (action.includes('public') || resourceType === 'content') {
    return 'public';
  }
  return 'internal';
}

/**
 * Get audit logs
 */
async function getAuditLogs(workspaceId, filters = {}) {
  try {
    const {
      userId = null,
      action = null,
      resourceType = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0
    } = filters;

    const query = { workspaceId };

    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await AuditLog.countDocuments(query);

    return {
      logs,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
  } catch (error) {
    logger.error('Error getting audit logs', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Configure data residency
 */
async function configureDataResidency(workspaceId, residencyConfig, userId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    const member = workspace.members.find(m => m.userId.toString() === userId.toString());
    if (!member || !member.permissions.canManageSettings) {
      throw new Error('Insufficient permissions');
    }

    const oldResidency = JSON.parse(JSON.stringify(workspace.settings.dataResidency));
    workspace.settings.dataResidency = {
      ...workspace.settings.dataResidency,
      ...residencyConfig
    };

    await workspace.save();

    // Log audit
    await logAudit(userId, 'data_residency_updated', 'workspace', workspaceId, {
      before: oldResidency,
      after: workspace.settings.dataResidency
    }, workspaceId);

    logger.info('Data residency configured', { workspaceId, region: residencyConfig.region });
    return workspace;
  } catch (error) {
    logger.error('Error configuring data residency', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Configure SLA
 */
async function configureSLA(workspaceId, slaConfig, userId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check permissions
    const member = workspace.members.find(m => m.userId.toString() === userId.toString());
    if (!member || !member.permissions.canManageSettings) {
      throw new Error('Insufficient permissions');
    }

    const oldSLA = JSON.parse(JSON.stringify(workspace.settings.sla));
    workspace.settings.sla = {
      ...workspace.settings.sla,
      ...slaConfig
    };

    await workspace.save();

    // Log audit
    await logAudit(userId, 'sla_updated', 'workspace', workspaceId, {
      before: oldSLA,
      after: workspace.settings.sla
    }, workspaceId);

    logger.info('SLA configured', { workspaceId });
    return workspace;
  } catch (error) {
    logger.error('Error configuring SLA', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Permission inheritance and delegation
 */
async function delegatePermission(userId, workspaceId, delegateToUserId, permissions, delegatedBy) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Check if delegator has permission to delegate
    const delegator = workspace.members.find(m => m.userId.toString() === delegatedBy.toString());
    if (!delegator || !delegator.permissions.canManageMembers) {
      throw new Error('Insufficient permissions to delegate');
    }

    const delegatee = workspace.members.find(m => m.userId.toString() === delegateToUserId.toString());
    if (!delegatee) {
      throw new Error('User is not a workspace member');
    }

    // Add delegated permissions
    const delegatedPermissions = {};
    permissions.forEach(permission => {
      if (delegator.permissions[permission]) {
        delegatedPermissions[`delegated_${permission}`] = true;
        delegatedPermissions[permission] = true;
      }
    });

    delegatee.permissions = { ...delegatee.permissions, ...delegatedPermissions };
    delegatee.delegatedBy = delegatedBy;
    delegatee.delegatedAt = new Date();
    delegatee.delegatedPermissions = permissions;

    await workspace.save();

    // Log audit
    await logAudit(delegatedBy, 'permission_delegated', 'workspace', workspaceId, {
      delegateTo: delegateToUserId,
      permissions
    }, workspaceId);

    logger.info('Permissions delegated', { workspaceId, delegateTo: delegateToUserId, permissions });
    return workspace;
  } catch (error) {
    logger.error('Error delegating permissions', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Create workspace from template
 */
async function createWorkspaceFromTemplate(userId, templateName, workspaceData) {
  try {
    const templates = {
      agency: {
        name: 'Agency Workspace',
        type: 'agency',
        settings: {
          features: {
            approvals: true,
            workflows: true,
            analytics: true,
            apiAccess: true
          },
          dataResidency: {
            region: 'global',
            compliance: { gdpr: true, ccpa: true }
          },
          sla: {
            uptime: 99.9,
            responseTime: 200,
            supportResponse: 4
          }
        }
      },
      client: {
        name: 'Client Workspace',
        type: 'client',
        settings: {
          features: {
            approvals: true,
            workflows: true,
            analytics: true,
            apiAccess: false
          },
          dataResidency: {
            region: 'us',
            compliance: { gdpr: false, ccpa: true }
          },
          sla: {
            uptime: 99.5,
            responseTime: 300,
            supportResponse: 8
          }
        }
      },
      brand: {
        name: 'Brand Workspace',
        type: 'brand',
        settings: {
          features: {
            approvals: true,
            workflows: true,
            analytics: true,
            apiAccess: false
          },
          dataResidency: {
            region: 'global',
            compliance: { gdpr: true }
          },
          sla: {
            uptime: 99.9,
            responseTime: 200,
            supportResponse: 4
          }
        }
      }
    };

    const template = templates[templateName] || templates.client;
    const workspace = await createWorkspace(userId, {
      ...workspaceData,
      ...template,
      name: workspaceData.name || template.name
    });

    logger.info('Workspace created from template', { userId, templateName, workspaceId: workspace._id });
    return workspace;
  } catch (error) {
    logger.error('Error creating workspace from template', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get audit log analytics
 */
async function getAuditLogAnalytics(workspaceId, timeframe = '30days') {
  try {
    const days = timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const logs = await AuditLog.find({
      workspaceId,
      timestamp: { $gte: cutoffDate }
    }).lean();

    const analytics = {
      totalActions: logs.length,
      byAction: {},
      byUser: {},
      byResourceType: {},
      byDay: {},
      topUsers: [],
      topActions: [],
      complianceEvents: 0,
      securityEvents: 0,
      trends: {}
    };

    // Analyze by action
    logs.forEach(log => {
      analytics.byAction[log.action] = (analytics.byAction[log.action] || 0) + 1;
      analytics.byResourceType[log.resourceType] = (analytics.byResourceType[log.resourceType] || 0) + 1;

      const userId = log.userId.toString();
      if (!analytics.byUser[userId]) {
        analytics.byUser[userId] = { count: 0, actions: {} };
      }
      analytics.byUser[userId].count++;
      analytics.byUser[userId].actions[log.action] = (analytics.byUser[userId].actions[log.action] || 0) + 1;

      // By day
      const day = new Date(log.timestamp).toISOString().split('T')[0];
      analytics.byDay[day] = (analytics.byDay[day] || 0) + 1;

      // Compliance events
      if (log.compliance?.gdprRelevant) {
        analytics.complianceEvents++;
      }

      // Security events
      if (log.action.includes('delete') || log.action.includes('permission') || log.action.includes('security')) {
        analytics.securityEvents++;
      }
    });

    // Top users
    analytics.topUsers = Object.entries(analytics.byUser)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([userId, data]) => ({
        userId,
        count: data.count,
        topActions: Object.entries(data.actions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([action, count]) => ({ action, count }))
      }));

    // Top actions
    analytics.topActions = Object.entries(analytics.byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Calculate trends
    const daysArray = Object.keys(analytics.byDay).sort();
    if (daysArray.length >= 2) {
      const recent = daysArray.slice(-7).reduce((sum, day) => sum + analytics.byDay[day], 0) / 7;
      const older = daysArray.slice(0, -7).reduce((sum, day) => sum + analytics.byDay[day], 0) / Math.max(1, daysArray.length - 7);
      analytics.trends = {
        direction: recent > older ? 'up' : recent < older ? 'down' : 'stable',
        change: Math.round(((recent - older) / Math.max(older, 1)) * 100)
      };
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting audit log analytics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Generate compliance report
 */
async function generateComplianceReport(workspaceId, reportType = 'gdpr') {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const report = {
      workspaceId,
      workspaceName: workspace.name,
      reportType,
      generatedAt: new Date(),
      compliance: {},
      dataInventory: {},
      recommendations: []
    };

    if (reportType === 'gdpr') {
      const { checkGDPRCompliance } = require('./complianceService');
      report.compliance = await checkGDPRCompliance(workspaceId);

      // Data inventory
      const Content = require('../models/Content');
      const User = require('../models/User');
      
      const contentCount = await Content.countDocuments({
        userId: { $in: workspace.members.map(m => m.userId) }
      });

      const userCount = workspace.members.length;

      report.dataInventory = {
        users: userCount,
        content: contentCount,
        dataResidency: workspace.settings.dataResidency.region,
        retentionPeriod: workspace.settings.sla.dataRetention
      };

      // Recommendations
      if (!report.compliance.gdprEnabled && workspace.settings.dataResidency.region === 'eu') {
        report.recommendations.push({
          priority: 'high',
          action: 'Enable GDPR compliance',
          reason: 'EU data residency requires GDPR compliance'
        });
      }
    }

    return report;
  } catch (error) {
    logger.error('Error generating compliance report', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Monitor SLA and send alerts
 */
async function monitorSLA(workspaceId) {
  try {
    const { getSLAStatus } = require('./complianceService');
    const sla = await getSLAStatus(workspaceId);

    const alerts = [];

    // Check for violations
    if (sla.violations && sla.violations.length > 0) {
      sla.violations.forEach((violation) => {
        alerts.push({
          type: 'sla_violation',
          severity: violation.severity,
          title: `SLA Violation: ${violation.type}`,
          message: violation.message,
          workspaceId,
          timestamp: new Date()
        });
      });
    }

    // Check for approaching violations
    if (sla.actual.uptime < sla.configured.uptime * 1.01) {
      alerts.push({
        type: 'sla_warning',
        severity: 'medium',
        title: 'SLA Uptime Warning',
        message: `Uptime ${sla.actual.uptime}% is close to SLA threshold ${sla.configured.uptime}%`,
        workspaceId,
        timestamp: new Date()
      });
    }

    return {
      sla,
      alerts,
      monitoredAt: new Date()
    };
  } catch (error) {
    logger.error('Error monitoring SLA', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get workspace analytics
 */
async function getWorkspaceAnalytics(workspaceId, timeframe = '30days') {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const days = timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const Content = require('../models/Content');
    const ScheduledPost = require('../models/ScheduledPost');
    const memberIds = workspace.members.map(m => m.userId);

    const [contentCount, postsCount, activeMembers] = await Promise.all([
      Content.countDocuments({
        userId: { $in: memberIds },
        createdAt: { $gte: cutoffDate }
      }),
      ScheduledPost.countDocuments({
        userId: { $in: memberIds },
        status: 'posted',
        postedAt: { $gte: cutoffDate }
      }),
      Workspace.aggregate([
        { $match: { _id: workspace._id } },
        { $unwind: '$members' },
        { $match: { 'members.status': 'active' } },
        { $count: 'activeMembers' }
      ])
    ]);

    const analytics = {
      workspace: {
        id: workspace._id,
        name: workspace.name,
        type: workspace.type,
        memberCount: workspace.members.length,
        activeMembers: activeMembers[0]?.activeMembers || 0
      },
      content: {
        total: contentCount,
        byType: {},
        byCategory: {}
      },
      posts: {
        total: postsCount,
        byPlatform: {},
        engagement: 0
      },
      activity: {
        contentCreated: contentCount,
        postsPublished: postsCount,
        avgPostsPerMember: workspace.members.length > 0 ? postsCount / workspace.members.length : 0
      },
      timeframe: `${days} days`
    };

    // Get content by type
    const contentByType = await Content.aggregate([
      { $match: { userId: { $in: memberIds }, createdAt: { $gte: cutoffDate } } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    contentByType.forEach((item) => {
      analytics.content.byType[item._id] = item.count;
    });

    // Get posts by platform
    const postsByPlatform = await ScheduledPost.aggregate([
      { $match: { userId: { $in: memberIds }, status: 'posted', postedAt: { $gte: cutoffDate } } },
      { $group: { _id: '$platform', count: { $sum: 1 }, engagement: { $sum: '$analytics.engagement' } } }
    ]);

    postsByPlatform.forEach((item) => {
      analytics.posts.byPlatform[item._id] = {
        count: item.count,
        engagement: item.engagement || 0
      };
      analytics.posts.engagement += item.engagement || 0;
    });

    return analytics;
  } catch (error) {
    logger.error('Error getting workspace analytics', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Publish workflow template to marketplace
 */
async function publishTemplateToMarketplace(templateId, userId) {
  try {
    const template = await WorkflowTemplate.findById(templateId);
    if (!template || template.createdBy.toString() !== userId.toString()) {
      throw new Error('Template not found or unauthorized');
    }

    template.isPublic = true;
    await template.save();

    // Log audit
    await logAudit(userId, 'template_published', 'workflow', templateId, {
      templateName: template.name
    }, template.workspaceId);

    logger.info('Template published to marketplace', { templateId, userId });
    return template;
  } catch (error) {
    logger.error('Error publishing template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Get marketplace templates
 */
async function getMarketplaceTemplates(category = null, limit = 20) {
  try {
    const query = { isPublic: true };
    if (category) {
      query.category = category;
    }

    const templates = await WorkflowTemplate.find(query)
      .populate('createdBy', 'name')
      .sort({ usageCount: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting marketplace templates', { error: error.message });
    throw error;
  }
}

module.exports = {
  createWorkspace,
  addWorkspaceMember,
  updateMemberPermissions,
  checkPermission,
  getUserWorkspaces,
  logAudit,
  getAuditLogs,
  configureDataResidency,
  configureSLA,
  getDefaultPermissions,
  delegatePermission,
  createWorkspaceFromTemplate,
  getAuditLogAnalytics,
  generateComplianceReport,
  monitorSLA,
  getWorkspaceAnalytics,
  publishTemplateToMarketplace,
  getMarketplaceTemplates
};

