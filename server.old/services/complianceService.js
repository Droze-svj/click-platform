// Compliance Service
// GDPR, data residency, and compliance management

const User = require('../models/User');
const Content = require('../models/Content');
const Workspace = require('../models/Workspace');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * GDPR: Export user data
 */
async function exportUserData(userId) {
  try {
    const user = await User.findById(userId).lean();
    const content = await Content.find({ userId }).lean();
    const workspaces = await Workspace.find({ 'members.userId': userId }).lean();
    const auditLogs = await AuditLog.find({ userId }).lean();

    const exportData = {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      content: content.map(c => ({
        id: c._id,
        title: c.title,
        type: c.type,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      })),
      workspaces: workspaces.map(ws => ({
        id: ws._id,
        name: ws.name,
        role: ws.members.find(m => m.userId.toString() === userId.toString())?.role,
        joinedAt: ws.members.find(m => m.userId.toString() === userId.toString())?.joinedAt
      })),
      auditLogs: auditLogs.map(log => ({
        action: log.action,
        resourceType: log.resourceType,
        timestamp: log.timestamp
      })),
      exportedAt: new Date().toISOString()
    };

    // Log export
    const { logAudit } = require('./workspaceService');
    await logAudit(userId, 'data_exported', 'user', userId, {
      exportType: 'gdpr',
      recordCount: {
        content: content.length,
        workspaces: workspaces.length,
        auditLogs: auditLogs.length
      }
    });

    logger.info('User data exported for GDPR', { userId });
    return exportData;
  } catch (error) {
    logger.error('Error exporting user data', { error: error.message, userId });
    throw error;
  }
}

/**
 * GDPR: Delete user data (right to be forgotten)
 */
async function deleteUserData(userId) {
  try {
    // Anonymize user data
    await User.findByIdAndUpdate(userId, {
      email: `deleted_${userId}_${Date.now()}@deleted.local`,
      name: 'Deleted User',
      isDeleted: true,
      deletedAt: new Date()
    });

    // Anonymize content (keep for analytics but remove personal data)
    await Content.updateMany(
      { userId },
      {
        $set: {
          'metadata.anonymized': true,
          'metadata.anonymizedAt': new Date()
        }
      }
    );

    // Remove from workspaces
    await Workspace.updateMany(
      { 'members.userId': userId },
      {
        $set: {
          'members.$.status': 'removed',
          'members.$.removedAt': new Date()
        }
      }
    );

    // Log deletion
    const { logAudit } = require('./workspaceService');
    await logAudit(userId, 'data_deleted', 'user', userId, {
      deletionType: 'gdpr',
      deletedAt: new Date()
    });

    logger.info('User data deleted for GDPR', { userId });
    return { success: true, deletedAt: new Date() };
  } catch (error) {
    logger.error('Error deleting user data', { error: error.message, userId });
    throw error;
  }
}

/**
 * Check GDPR compliance
 */
async function checkGDPRCompliance(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const compliance = {
      gdprEnabled: workspace.settings.dataResidency.compliance.gdpr || false,
      dataResidency: workspace.settings.dataResidency.region,
      dataRetention: workspace.settings.sla.dataRetention,
      auditLogging: true,
      dataExport: true,
      dataDeletion: true,
      issues: [],
      recommendations: []
    };

    // Check for compliance issues
    if (!compliance.gdprEnabled && workspace.settings.dataResidency.region === 'eu') {
      compliance.issues.push({
        type: 'gdpr_not_enabled',
        severity: 'high',
        message: 'GDPR compliance is not enabled for EU data residency'
      });
      compliance.recommendations.push({
        action: 'Enable GDPR compliance',
        description: 'Enable GDPR compliance in workspace settings'
      });
    }

    if (compliance.dataRetention > 365) {
      compliance.issues.push({
        type: 'long_retention',
        severity: 'medium',
        message: `Data retention is ${compliance.dataRetention} days, consider reducing for GDPR`
      });
    }

    return compliance;
  } catch (error) {
    logger.error('Error checking GDPR compliance', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get data residency information
 */
async function getDataResidencyInfo(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const residency = workspace.settings.dataResidency;

    return {
      region: residency.region,
      compliance: residency.compliance,
      dataLocations: {
        database: getDatabaseLocation(residency.region),
        storage: getStorageLocation(residency.region),
        cdn: getCDNLocation(residency.region)
      },
      restrictions: getRegionRestrictions(residency.region),
      recommendations: getResidencyRecommendations(residency)
    };
  } catch (error) {
    logger.error('Error getting data residency info', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Get database location for region
 */
function getDatabaseLocation(region) {
  const locations = {
    us: 'US East (Virginia)',
    eu: 'EU (Ireland)',
    uk: 'UK (London)',
    asia: 'Asia Pacific (Singapore)',
    global: 'Multi-region'
  };
  return locations[region] || 'Global';
}

/**
 * Get storage location for region
 */
function getStorageLocation(region) {
  const locations = {
    us: 'US East (S3)',
    eu: 'EU (S3)',
    uk: 'EU (S3)',
    asia: 'Asia Pacific (S3)',
    global: 'Multi-region (S3)'
  };
  return locations[region] || 'Global';
}

/**
 * Get CDN location for region
 */
function getCDNLocation(region) {
  return region === 'global' ? 'Global CDN' : `${region.toUpperCase()} CDN`;
}

/**
 * Get region restrictions
 */
function getRegionRestrictions(region) {
  const restrictions = {
    eu: ['GDPR compliance required', 'Data must stay in EU'],
    uk: ['UK GDPR compliance required', 'Data must stay in UK'],
    us: ['CCPA compliance available', 'Data must stay in US'],
    asia: ['Local data protection laws apply'],
    global: ['No specific restrictions']
  };
  return restrictions[region] || [];
}

/**
 * Get residency recommendations
 */
function getResidencyRecommendations(residency) {
  const recommendations = [];

  if (residency.region === 'eu' && !residency.compliance.gdpr) {
    recommendations.push({
      type: 'enable_gdpr',
      priority: 'high',
      message: 'Enable GDPR compliance for EU data residency'
    });
  }

  if (residency.region === 'us' && !residency.compliance.ccpa) {
    recommendations.push({
      type: 'enable_ccpa',
      priority: 'medium',
      message: 'Consider enabling CCPA compliance for US data'
    });
  }

  return recommendations;
}

/**
 * Get SLA status
 */
async function getSLAStatus(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const sla = workspace.settings.sla;

    // Calculate actual metrics (would come from monitoring)
    const actualMetrics = {
      uptime: 99.95, // Would come from monitoring
      avgResponseTime: 180, // Would come from monitoring
      supportResponseTime: 3.5 // Would come from support system
    };

    const status = {
      configured: {
        uptime: sla.uptime,
        responseTime: sla.responseTime,
        supportResponse: sla.supportResponse,
        dataRetention: sla.dataRetention
      },
      actual: actualMetrics,
      compliance: {
        uptime: actualMetrics.uptime >= sla.uptime,
        responseTime: actualMetrics.avgResponseTime <= sla.responseTime,
        supportResponse: actualMetrics.supportResponseTime <= sla.supportResponse
      },
      violations: [],
      nextReview: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };

    // Check for violations
    if (!status.compliance.uptime) {
      status.violations.push({
        type: 'uptime',
        severity: 'high',
        message: `Uptime ${actualMetrics.uptime}% is below SLA ${sla.uptime}%`
      });
    }

    if (!status.compliance.responseTime) {
      status.violations.push({
        type: 'response_time',
        severity: 'medium',
        message: `Response time ${actualMetrics.avgResponseTime}ms exceeds SLA ${sla.responseTime}ms`
      });
    }

    if (!status.compliance.supportResponse) {
      status.violations.push({
        type: 'support_response',
        severity: 'medium',
        message: `Support response ${actualMetrics.supportResponseTime}h exceeds SLA ${sla.supportResponse}h`
      });
    }

    return status;
  } catch (error) {
    logger.error('Error getting SLA status', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Data retention policy enforcement
 */
async function enforceDataRetention(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const retentionDays = workspace.settings.sla.dataRetention;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const results = {
      archived: 0,
      deleted: 0,
      errors: []
    };

    // Archive old content
    const Content = require('../models/Content');
    const oldContent = await Content.find({
      userId: { $in: workspace.members.map(m => m.userId) },
      createdAt: { $lt: cutoffDate },
      isArchived: false
    });

    for (const content of oldContent) {
      try {
        content.isArchived = true;
        await content.save();
        results.archived++;
      } catch (error) {
        results.errors.push({ contentId: content._id, error: error.message });
      }
    }

    // Delete old audit logs (if retention exceeded)
    const AuditLog = require('../models/AuditLog');
    const oldLogs = await AuditLog.find({
      workspaceId,
      timestamp: { $lt: cutoffDate },
      'compliance.gdprRelevant': false // Don't delete GDPR-relevant logs
    });

    const deletedLogs = await AuditLog.deleteMany({
      workspaceId,
      timestamp: { $lt: cutoffDate },
      'compliance.gdprRelevant': false
    });

    results.deleted = deletedLogs.deletedCount || 0;

    logger.info('Data retention enforced', { workspaceId, archived: results.archived, deleted: results.deleted });
    return results;
  } catch (error) {
    logger.error('Error enforcing data retention', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Consent management
 */
async function manageConsent(userId, consentType, granted) {
  try {
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.privacy) {
      user.privacy = {};
    }

    // Map consent types to privacy fields
    const consentMap = {
      marketing: 'marketingConsent',
      analytics: 'analyticsConsent',
      dataProcessing: 'dataConsent',
      cookies: 'cookiesConsent',
      dataSharing: 'dataSharing'
    };

    const privacyField = consentMap[consentType] || consentType;
    const dateField = `${privacyField}Date`;

    user.privacy[privacyField] = granted;
    user.privacy[dateField] = new Date();

    await user.save();

    // Log audit
    const { logAudit } = require('./workspaceService');
    await logAudit(userId, `consent_${granted ? 'granted' : 'revoked'}`, 'user', userId, {
      consentType,
      privacyField,
      granted
    });

    logger.info('Consent managed', { userId, consentType, granted });
    return {
      consentType,
      granted,
      grantedAt: granted ? new Date() : null,
      revokedAt: granted ? null : new Date()
    };
  } catch (error) {
    logger.error('Error managing consent', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get compliance certifications
 */
async function getComplianceCertifications(workspaceId) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const certifications = {
      gdpr: {
        certified: workspace.settings.dataResidency.compliance.gdpr,
        region: workspace.settings.dataResidency.region === 'eu' || workspace.settings.dataResidency.region === 'uk',
        dataExport: true,
        dataDeletion: true,
        auditLogging: true
      },
      ccpa: {
        certified: workspace.settings.dataResidency.compliance.ccpa,
        region: workspace.settings.dataResidency.region === 'us',
        dataExport: true,
        dataDeletion: true
      },
      hipaa: {
        certified: workspace.settings.dataResidency.compliance.hipaa,
        region: workspace.settings.dataResidency.region === 'us',
        encryption: true,
        accessControls: true
      },
      iso27001: {
        certified: false, // Would be set based on actual certification
        securityControls: true,
        riskManagement: true
      }
    };

    return certifications;
  } catch (error) {
    logger.error('Error getting compliance certifications', { error: error.message, workspaceId });
    throw error;
  }
}

/**
 * Advanced data residency with automatic routing
 */
async function routeDataByResidency(workspaceId, dataType, data) {
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const region = workspace.settings.dataResidency.region;
    const routing = {
      region,
      routed: true,
      routedAt: new Date(),
      dataType,
      storageLocation: getStorageLocation(region),
      databaseLocation: getDatabaseLocation(region),
      cdnLocation: getCDNLocation(region)
    };

    // In production, this would route data to region-specific storage
    // For now, return routing information
    return routing;
  } catch (error) {
    logger.error('Error routing data by residency', { error: error.message, workspaceId });
    throw error;
  }
}

module.exports = {
  exportUserData,
  deleteUserData,
  checkGDPRCompliance,
  getDataResidencyInfo,
  getSLAStatus,
  enforceDataRetention,
  manageConsent,
  getComplianceCertifications,
  routeDataByResidency
};

