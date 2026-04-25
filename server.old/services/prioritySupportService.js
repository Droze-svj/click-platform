// Priority Support Service
// SLAs, dedicated onboarding, status monitoring

const SupportSLA = require('../models/SupportSLA');
const SupportTicket = require('../models/SupportTicket');
const PlatformStatus = require('../models/PlatformStatus');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get or create support SLA
 */
async function getSupportSLA(userId) {
  try {
    let sla = await SupportSLA.findOne({ userId, isActive: true }).lean();
    
    if (!sla) {
      // Determine tier based on user's membership
      const user = await User.findById(userId).populate('membershipPackage').lean();
      const tier = determineSupportTier(user);
      
      // Create default SLA
      sla = await createDefaultSLA(userId, tier);
    }

    return sla;
  } catch (error) {
    logger.error('Error getting support SLA', { error: error.message, userId });
    throw error;
  }
}

/**
 * Determine support tier
 */
function determineSupportTier(user) {
  // Would check user's membership package
  // For now, return based on package name
  const packageName = user.membershipPackage?.name?.toLowerCase() || '';
  
  if (packageName.includes('enterprise')) {
    return 'enterprise';
  } else if (packageName.includes('agency') || packageName.includes('business')) {
    return 'priority';
  } else if (packageName.includes('dedicated')) {
    return 'dedicated';
  } else {
    return 'standard';
  }
}

/**
 * Create default SLA
 */
async function createDefaultSLA(userId, tier) {
  const slaConfigs = {
    standard: {
      firstResponse: { minutes: 24 * 60, priority: 'medium' }, // 24 hours
      resolution: { hours: 72, priority: 'medium' }, // 3 days
      availability: { percentage: 99.5, hours: 'Business hours' }
    },
    priority: {
      firstResponse: { minutes: 60, priority: 'high' }, // 1 hour
      resolution: { hours: 24, priority: 'high' }, // 1 day
      availability: { percentage: 99.9, hours: '24/7' }
    },
    dedicated: {
      firstResponse: { minutes: 30, priority: 'high' }, // 30 minutes
      resolution: { hours: 12, priority: 'high' }, // 12 hours
      availability: { percentage: 99.9, hours: '24/7' }
    },
    enterprise: {
      firstResponse: { minutes: 15, priority: 'urgent' }, // 15 minutes
      resolution: { hours: 6, priority: 'urgent' }, // 6 hours
      availability: { percentage: 99.99, hours: '24/7' }
    }
  };

  const config = slaConfigs[tier] || slaConfigs.standard;

  const sla = new SupportSLA({
    userId,
    tier,
    targets: {
      firstResponse: config.firstResponse,
      resolution: config.resolution,
      availability: config.availability
    },
    performance: {
      firstResponse: { onTime: 0, total: 0 },
      resolution: { onTime: 0, total: 0 }
    }
  });

  await sla.save();
  return sla;
}

/**
 * Check SLA compliance for ticket
 */
async function checkSLACompliance(ticketId) {
  try {
    const ticket = await SupportTicket.findById(ticketId)
      .populate('userId')
      .lean();

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const sla = await getSupportSLA(ticket.userId._id);

    // Check first response
    let firstResponseOnTime = null;
    if (ticket.sla.firstResponseAt) {
      const responseTime = (ticket.sla.firstResponseAt - ticket.createdAt) / (1000 * 60); // minutes
      firstResponseOnTime = responseTime <= sla.targets.firstResponse.minutes;
      ticket.sla.onTime = firstResponseOnTime;
    }

    // Check resolution
    let resolutionOnTime = null;
    if (ticket.status === 'resolved' && ticket.sla.resolvedAt) {
      const resolutionTime = (ticket.sla.resolvedAt - ticket.createdAt) / (1000 * 60 * 60); // hours
      resolutionOnTime = sla.targets.resolution.hours 
        ? resolutionTime <= sla.targets.resolution.hours 
        : null;
    }

    // Update SLA performance
    await updateSLAPerformance(sla._id, {
      firstResponseOnTime,
      resolutionOnTime
    });

    return {
      firstResponseOnTime,
      resolutionOnTime,
      sla: {
        tier: sla.tier,
        targets: sla.targets
      }
    };
  } catch (error) {
    logger.error('Error checking SLA compliance', { error: error.message, ticketId });
    throw error;
  }
}

/**
 * Update SLA performance
 */
async function updateSLAPerformance(slaId, metrics) {
  try {
    const sla = await SupportSLA.findById(slaId);
    if (!sla) {
      throw new Error('SLA not found');
    }

    if (metrics.firstResponseOnTime !== null) {
      sla.performance.firstResponse.total++;
      if (metrics.firstResponseOnTime) {
        // Would calculate actual on-time percentage
        sla.performance.firstResponse.onTime = 
          ((sla.performance.firstResponse.onTime * (sla.performance.firstResponse.total - 1)) + 100) / 
          sla.performance.firstResponse.total;
      } else {
        sla.performance.firstResponse.onTime = 
          (sla.performance.firstResponse.onTime * (sla.performance.firstResponse.total - 1)) / 
          sla.performance.firstResponse.total;
      }
    }

    if (metrics.resolutionOnTime !== null) {
      sla.performance.resolution.total++;
      if (metrics.resolutionOnTime) {
        sla.performance.resolution.onTime = 
          ((sla.performance.resolution.onTime * (sla.performance.resolution.total - 1)) + 100) / 
          sla.performance.resolution.total;
      } else {
        sla.performance.resolution.onTime = 
          (sla.performance.resolution.onTime * (sla.performance.resolution.total - 1)) / 
          sla.performance.resolution.total;
      }
    }

    await sla.save();
  } catch (error) {
    logger.error('Error updating SLA performance', { error: error.message, slaId });
  }
}

/**
 * Get dedicated onboarding status
 */
async function getOnboardingStatus(userId) {
  try {
    const sla = await getSupportSLA(userId);
    
    return {
      completed: sla.dedicated.onboarding.completed,
      assignedTo: sla.dedicated.onboarding.assignedTo,
      accountManager: sla.dedicated.accountManager,
      tier: sla.tier,
      hasDedicatedSupport: ['dedicated', 'enterprise'].includes(sla.tier)
    };
  } catch (error) {
    logger.error('Error getting onboarding status', { error: error.message, userId });
    throw error;
  }
}

/**
 * Complete onboarding
 */
async function completeOnboarding(userId, completedBy) {
  try {
    const sla = await SupportSLA.findOne({ userId, isActive: true });
    if (!sla) {
      throw new Error('SLA not found');
    }

    sla.dedicated.onboarding.completed = true;
    sla.dedicated.onboarding.completedAt = new Date();
    sla.dedicated.onboarding.assignedTo = completedBy;
    await sla.save();

    return sla;
  } catch (error) {
    logger.error('Error completing onboarding', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get platform status
 */
async function getPlatformStatus() {
  try {
    const components = await PlatformStatus.find()
      .sort({ updatedAt: -1 })
      .lean();

    // Calculate overall status
    const statuses = components.map(c => c.status);
    let overallStatus = 'operational';
    
    if (statuses.includes('down')) {
      overallStatus = 'down';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    } else if (statuses.includes('maintenance')) {
      overallStatus = 'maintenance';
    }

    return {
      overall: overallStatus,
      components: components.map(c => ({
        component: c.component,
        status: c.status,
        message: c.details.message,
        impact: c.details.impact,
        affectedFeatures: c.details.affectedFeatures,
        metrics: c.metrics,
        maintenance: c.maintenance
      })),
      lastUpdated: components[0]?.updatedAt || new Date()
    };
  } catch (error) {
    logger.error('Error getting platform status', { error: error.message });
    throw error;
  }
}

/**
 * Update component status
 */
async function updateComponentStatus(component, status, details = {}) {
  try {
    let statusDoc = await PlatformStatus.findOne({ component })
      .sort({ createdAt: -1 });

    if (!statusDoc || statusDoc.status !== status) {
      // Create new status entry
      statusDoc = new PlatformStatus({
        component,
        status,
        details: {
          message: details.message || '',
          impact: details.impact || 'none',
          affectedFeatures: details.affectedFeatures || []
        },
        metrics: details.metrics || {},
        maintenance: details.maintenance || {}
      });

      // Add to timeline
      statusDoc.timeline.push({
        status,
        message: details.message || '',
        timestamp: new Date()
      });
    } else {
      // Update existing
      statusDoc.details = {
        message: details.message || statusDoc.details.message,
        impact: details.impact || statusDoc.details.impact,
        affectedFeatures: details.affectedFeatures || statusDoc.details.affectedFeatures
      };
      statusDoc.metrics = details.metrics || statusDoc.metrics;
      statusDoc.maintenance = details.maintenance || statusDoc.maintenance;
    }

    await statusDoc.save();
    return statusDoc;
  } catch (error) {
    logger.error('Error updating component status', { error: error.message, component });
    throw error;
  }
}

module.exports = {
  getSupportSLA,
  checkSLACompliance,
  getOnboardingStatus,
  completeOnboarding,
  getPlatformStatus,
  updateComponentStatus
};


