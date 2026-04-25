// Music Compliance Check Service
// Automated compliance checks and validation

const logger = require('../utils/logger');
const MusicLicenseUsage = require('../models/MusicLicenseUsage');

/**
 * Run automated compliance check
 */
async function runComplianceCheck(userId, workspaceId, options = {}) {
  const {
    checkAttribution = true,
    checkRegistration = true,
    checkExpiration = true,
    checkRestrictions = true
  } = options;

  try {
    const issues = [];

    // Get recent usage logs
    const query = { userId };
    if (workspaceId) query.workspaceId = workspaceId;

    const usageLogs = await MusicLicenseUsage.find(query)
      .sort({ renderTimestamp: -1 })
      .limit(100) // Check last 100 renders
      .lean();

    // Check attribution compliance
    if (checkAttribution) {
      const attributionIssues = await checkAttributionCompliance(usageLogs);
      issues.push(...attributionIssues);
    }

    // Check license registration
    if (checkRegistration) {
      const registrationIssues = await checkRegistrationCompliance(usageLogs);
      issues.push(...registrationIssues);
    }

    // Check license expiration
    if (checkExpiration) {
      const expirationIssues = await checkExpirationCompliance(usageLogs);
      issues.push(...expirationIssues);
    }

    // Check restrictions
    if (checkRestrictions) {
      const restrictionIssues = await checkRestrictionCompliance(usageLogs);
      issues.push(...restrictionIssues);
    }

    return {
      checked: usageLogs.length,
      issuesFound: issues.length,
      issues,
      severity: calculateSeverity(issues),
      passed: issues.length === 0
    };
  } catch (error) {
    logger.error('Error running compliance check', {
      error: error.message,
      userId,
      workspaceId
    });
    throw error;
  }
}

/**
 * Check attribution compliance
 */
async function checkAttributionCompliance(usageLogs) {
  const issues = [];

  const missingAttribution = usageLogs.filter(
    log => log.attributionRequired && !log.attributionAdded
  );

  missingAttribution.forEach(log => {
    issues.push({
      type: 'missing_attribution',
      severity: 'high',
      usageLogId: log._id.toString(),
      renderId: log.renderId,
      trackId: log.trackId,
      message: `Attribution required for track but not added: ${log.trackTitle || log.trackId}`,
      recommendation: 'Add attribution to video description or metadata'
    });
  });

  return issues;
}

/**
 * Check registration compliance
 */
async function checkRegistrationCompliance(usageLogs) {
  const issues = [];

  const unregistered = usageLogs.filter(
    log => (log.licenseType === 'per_export' || log.licenseType === 'per_end_user') &&
           !log.providerLicenseRegistered &&
           log.complianceStatus !== 'failed'
  );

  unregistered.forEach(log => {
    issues.push({
      type: 'unregistered_license',
      severity: 'high',
      usageLogId: log._id.toString(),
      renderId: log.renderId,
      trackId: log.trackId,
      provider: log.provider,
      message: `License registration required but not completed for provider: ${log.provider}`,
      recommendation: `Register license with ${log.provider} provider API`
    });
  });

  return issues;
}

/**
 * Check expiration compliance
 */
async function checkExpirationCompliance(usageLogs) {
  const issues = [];

  // Get unique licensed tracks
  const licensedTracks = usageLogs
    .filter(log => log.source === 'licensed' && log.licenseId)
    .map(log => ({ trackId: log.trackId, licenseId: log.licenseId }));

  const uniqueLicenses = [...new Set(licensedTracks.map(t => t.licenseId.toString()))];

  for (const licenseId of uniqueLicenses) {
    const MusicLicense = require('../models/MusicLicense');
    const license = await MusicLicense.findById(licenseId).lean();

    if (license && license.licenseEndDate) {
      const expiresAt = new Date(license.licenseEndDate);
      const now = new Date();
      const daysUntilExpiration = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

      if (expiresAt < now) {
        issues.push({
          type: 'expired_license',
          severity: 'critical',
          licenseId: license._id.toString(),
          trackId: license.providerTrackId,
          expiresAt: license.expiresAt,
          message: `License has expired: ${license.title || licenseId}`,
          recommendation: 'Renew license or remove track from projects'
        });
      } else if (daysUntilExpiration <= 30) {
        issues.push({
          type: 'expiring_license',
          severity: 'medium',
          licenseId: license._id.toString(),
          trackId: license.providerTrackId,
          expiresAt: license.expiresAt,
          daysUntilExpiration,
          message: `License expires in ${daysUntilExpiration} days: ${license.title || licenseId}`,
          recommendation: 'Consider renewing license soon'
        });
      }
    }
  }

  return issues;
}

/**
 * Check restriction compliance
 */
async function checkRestrictionCompliance(usageLogs) {
  const issues = [];

  // Check if any logs indicate restriction violations
  const violated = usageLogs.filter(
    log => log.complianceStatus === 'failed' && log.complianceNotes
  );

  violated.forEach(log => {
    issues.push({
      type: 'restriction_violation',
      severity: 'critical',
      usageLogId: log._id.toString(),
      renderId: log.renderId,
      trackId: log.trackId,
      message: log.complianceNotes || 'Restriction violation detected',
      recommendation: 'Review and fix restriction violations'
    });
  });

  return issues;
}

/**
 * Calculate overall severity
 */
function calculateSeverity(issues) {
  if (issues.length === 0) return 'none';

  const severities = issues.map(i => i.severity);
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

/**
 * Auto-fix compliance issues where possible
 */
async function autoFixComplianceIssues(usageLogId, userId) {
  try {
    const usageLog = await MusicLicenseUsage.findOne({
      _id: usageLogId,
      userId
    });

    if (!usageLog) {
      throw new Error('Usage log not found');
    }

    const fixes = [];

    // Auto-register license if needed
    if ((usageLog.licenseType === 'per_export' || usageLog.licenseType === 'per_end_user') &&
        !usageLog.providerLicenseRegistered) {
      try {
        const { registerLicenseUsage } = require('./musicLicenseRegistrationService');
        await registerLicenseUsage(usageLogId.toString());
        fixes.push({
          type: 'license_registration',
          fixed: true,
          message: 'License automatically registered with provider'
        });
      } catch (error) {
        fixes.push({
          type: 'license_registration',
          fixed: false,
          error: error.message
        });
      }
    }

    return {
      usageLogId,
      fixes,
      allFixed: fixes.every(f => f.fixed)
    };
  } catch (error) {
    logger.error('Error auto-fixing compliance issues', {
      error: error.message,
      usageLogId
    });
    throw error;
  }
}

module.exports = {
  runComplianceCheck,
  autoFixComplianceIssues
};

