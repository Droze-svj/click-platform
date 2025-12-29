// Agency Service
// Multi-client management, white-label portals, bulk operations

const Workspace = require('../models/Workspace');
const WhiteLabelPortal = require('../models/WhiteLabelPortal');
const Content = require('../models/Content');
const ScheduledPost = require('../models/ScheduledPost');
const ContentApproval = require('../models/ContentApproval');
const logger = require('../utils/logger');
const mongoose = require('mongoose');

/**
 * Create white-label portal for client
 */
async function createWhiteLabelPortal(agencyWorkspaceId, clientWorkspaceId, portalData) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      throw new Error('Agency workspace not found');
    }

    const client = await Workspace.findById(clientWorkspaceId);
    if (!client) {
      throw new Error('Client workspace not found');
    }

    const {
      subdomain,
      customDomain = null,
      branding = {},
      settings = {},
      features = {}
    } = portalData;

    // Generate subdomain if not provided
    const finalSubdomain = subdomain || `${client.name.toLowerCase().replace(/\s+/g, '-')}-portal`;

    const portal = new WhiteLabelPortal({
      workspaceId: agencyWorkspaceId,
      clientId: clientWorkspaceId,
      subdomain: finalSubdomain,
      customDomain,
      branding: {
        logo: branding.logo || agency.settings.branding.logo,
        primaryColor: branding.primaryColor || agency.settings.branding.primaryColor || '#6366f1',
        secondaryColor: branding.secondaryColor || agency.settings.branding.secondaryColor || '#8b5cf6',
        favicon: branding.favicon,
        customCSS: branding.customCSS,
        customHTML: branding.customHTML
      },
      settings: {
        showAgencyBranding: settings.showAgencyBranding || false,
        allowClientPosting: settings.allowClientPosting || false,
        allowClientScheduling: settings.allowClientScheduling !== false,
        allowClientAnalytics: settings.allowClientAnalytics !== false,
        allowClientApprovals: settings.allowClientApprovals !== false,
        showPricing: settings.showPricing || false,
        customFooter: settings.customFooter,
        customHeader: settings.customHeader
      },
      features: {
        contentLibrary: features.contentLibrary !== false,
        approvalWorkflow: features.approvalWorkflow !== false,
        analytics: features.analytics !== false,
        scheduling: features.scheduling !== false,
        reporting: features.reporting !== false
      },
      access: {
        publicUrl: `https://${finalSubdomain}.click.app`,
        requiresAuth: true,
        allowedEmails: [],
        allowedDomains: []
      }
    });

    await portal.save();

    // Log audit
    const { logAudit } = require('./workspaceService');
    await logAudit(agency.ownerId, 'portal_created', 'workspace', agencyWorkspaceId, {
      clientId: clientWorkspaceId,
      subdomain: finalSubdomain
    }, agencyWorkspaceId);

    logger.info('White-label portal created', { agencyWorkspaceId, clientWorkspaceId, subdomain: finalSubdomain });
    return portal;
  } catch (error) {
    logger.error('Error creating white-label portal', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Bulk schedule posts across multiple clients
 */
async function bulkScheduleAcrossClients(agencyWorkspaceId, scheduleData) {
  try {
    const {
      clientIds,
      content,
      platforms,
      scheduleType = 'optimal', // optimal, custom, immediate
      customDates = [],
      timezone = 'UTC'
    } = scheduleData;

    if (!clientIds || !Array.isArray(clientIds) || clientIds.length === 0) {
      throw new Error('Client IDs are required');
    }

    const results = {
      total: 0,
      successful: 0,
      failed: 0,
      scheduled: [],
      errors: []
    };

    for (const clientId of clientIds) {
      try {
        const client = await Workspace.findById(clientId);
        if (!client) {
          results.errors.push({ clientId, error: 'Client not found' });
          results.failed++;
          continue;
        }

        // Get client members
        const clientMembers = client.members.filter(m => m.status === 'active');
        
        for (const member of clientMembers) {
          try {
            const scheduledPosts = await scheduleForClient(
              member.userId,
              clientId,
              content,
              platforms,
              scheduleType,
              customDates,
              timezone,
              agencyWorkspaceId
            );

            results.scheduled.push({
              clientId,
              userId: member.userId,
              count: scheduledPosts.length,
              posts: scheduledPosts
            });

            results.successful += scheduledPosts.length;
            results.total += scheduledPosts.length;
          } catch (error) {
            results.errors.push({ clientId, userId: member.userId, error: error.message });
            results.failed++;
          }
        }
      } catch (error) {
        results.errors.push({ clientId, error: error.message });
        results.failed++;
      }
    }

    // Log audit
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (agency) {
      const { logAudit } = require('./workspaceService');
      await logAudit(agency.ownerId, 'bulk_schedule', 'workspace', agencyWorkspaceId, {
        clientCount: clientIds.length,
        totalScheduled: results.total,
        successful: results.successful,
        failed: results.failed
      }, agencyWorkspaceId);
    }

    logger.info('Bulk scheduling completed', { agencyWorkspaceId, total: results.total, successful: results.successful });
    return results;
  } catch (error) {
    logger.error('Error in bulk scheduling', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Schedule posts for a single client
 */
async function scheduleForClient(userId, clientId, content, platforms, scheduleType, customDates, timezone, agencyWorkspaceId = null) {
  const scheduledPosts = [];
  const clientWorkspace = await Workspace.findById(clientId);

  // Create content if needed
  let contentId = content.contentId;
  if (!contentId && content.text) {
    const newContent = new Content({
      userId,
      workspaceId: clientId,
      clientWorkspaceId: clientId,
      agencyWorkspaceId: agencyWorkspaceId,
      title: content.title || 'Bulk Scheduled Post',
      content: { text: content.text },
      type: content.type || 'post',
      platforms: platforms || ['twitter', 'linkedin', 'facebook', 'instagram']
    });
    await newContent.save();
    contentId = newContent._id;
  }

  // Schedule for each platform
  for (const platform of platforms || []) {
    let scheduledTime;

    if (scheduleType === 'immediate') {
      scheduledTime = new Date();
    } else if (scheduleType === 'custom' && customDates.length > 0) {
      scheduledTime = customDates.shift() || new Date();
    } else {
      // Use optimal time prediction
      const { predictOptimalTime } = require('./smartScheduleOptimizationService');
      const optimal = await predictOptimalTime(userId, platform, timezone);
      scheduledTime = optimal.optimalTime || new Date();
    }

    const scheduledPost = new ScheduledPost({
      userId,
      workspaceId: clientId,
      clientWorkspaceId: clientId,
      agencyWorkspaceId: agencyWorkspaceId,
      contentId,
      platform,
      scheduledTime,
      timezone,
      status: 'scheduled',
      metadata: {
        bulkScheduled: true,
        clientId
      }
    });

    await scheduledPost.save();
    scheduledPosts.push(scheduledPost);
  }

  return scheduledPosts;
}

/**
 * Bulk import content
 */
async function bulkImportContent(agencyWorkspaceId, clientId, importData) {
  try {
    const {
      content = [],
      format = 'json', // json, csv, excel
      autoSchedule = false,
      platforms = []
    } = importData;

    if (!Array.isArray(content) || content.length === 0) {
      throw new Error('Content array is required');
    }

    const client = await Workspace.findById(clientId);
    if (!client) {
      throw new Error('Client workspace not found');
    }

    const results = {
      imported: 0,
      scheduled: 0,
      failed: 0,
      errors: []
    };

    for (const item of content) {
      try {
        // Get first active member as content owner
        const member = client.members.find(m => m.status === 'active');
        if (!member) {
          results.errors.push({ item, error: 'No active members in client workspace' });
          results.failed++;
          continue;
        }

        const newContent = new Content({
          userId: member.userId,
          workspaceId: clientId,
          clientWorkspaceId: clientId,
          agencyWorkspaceId: agencyWorkspaceId,
          title: item.title || item.text?.substring(0, 100) || 'Imported Content',
          content: {
            text: item.text || item.content,
            images: item.images || [],
            videos: item.videos || []
          },
          type: item.type || 'post',
          platforms: item.platforms || platforms || ['twitter', 'linkedin'],
          hashtags: item.hashtags || [],
          metadata: {
            imported: true,
            importDate: new Date(),
            originalData: item
          }
        });

        await newContent.save();
        results.imported++;

        // Auto-schedule if requested
        if (autoSchedule && platforms.length > 0) {
          const scheduled = await scheduleForClient(
            member.userId,
            clientId,
            { contentId: newContent._id },
            platforms,
            'optimal',
            [],
            'UTC'
          );
          results.scheduled += scheduled.length;
        }
      } catch (error) {
        results.errors.push({ item, error: error.message });
        results.failed++;
      }
    }

    // Log audit
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (agency) {
      const { logAudit } = require('./workspaceService');
      await logAudit(agency.ownerId, 'bulk_import', 'workspace', agencyWorkspaceId, {
        clientId,
        imported: results.imported,
        scheduled: results.scheduled,
        failed: results.failed
      }, agencyWorkspaceId);
    }

    logger.info('Bulk import completed', { agencyWorkspaceId, clientId, imported: results.imported });
    return results;
  } catch (error) {
    logger.error('Error in bulk import', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get client approval dashboard
 */
async function getClientApprovalDashboard(agencyWorkspaceId, clientId = null) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      throw new Error('Agency workspace not found');
    }

    const query = {};
    if (clientId) {
      query['metadata.clientId'] = clientId;
    } else {
      // Get all client workspaces
      const clients = await Workspace.find({
        type: 'client',
        'members.userId': agency.ownerId
      }).select('_id');
      query['metadata.clientId'] = { $in: clients.map(c => c._id) };
    }

    const approvals = await ContentApproval.find({
      ...query,
      status: { $in: ['pending', 'in_progress'] }
    })
      .populate('contentId', 'title type')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const stats = {
      pending: approvals.filter(a => a.status === 'pending').length,
      inProgress: approvals.filter(a => a.status === 'in_progress').length,
      overdue: approvals.filter(a => {
        if (!a.timeout) return false;
        return new Date(a.timeout) < new Date() && a.status === 'pending';
      }).length,
      byClient: {},
      byPriority: {
        high: 0,
        medium: 0,
        low: 0
      }
    };

    // Group by client
    approvals.forEach(approval => {
      const clientId = approval.metadata?.clientId?.toString();
      if (clientId) {
        if (!stats.byClient[clientId]) {
          stats.byClient[clientId] = { pending: 0, inProgress: 0, overdue: 0 };
        }
        stats.byClient[clientId][approval.status === 'pending' ? 'pending' : 'inProgress']++;
      }
    });

    return {
      approvals,
      stats,
      total: approvals.length
    };
  } catch (error) {
    logger.error('Error getting client approval dashboard', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Cross-client benchmarking
 */
async function getCrossClientBenchmarking(agencyWorkspaceId, timeframe = '30days') {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      throw new Error('Agency workspace not found');
    }

    const days = timeframe === '7days' ? 7 : timeframe === '30days' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get all client workspaces
    const clients = await Workspace.find({
      type: 'client',
      'members.userId': agency.ownerId
    }).lean();

    const clientIds = clients.map(c => c._id);
    const memberIds = clients.flatMap(c => c.members.map(m => m.userId));

    // Get content and post data
    const [contentStats, postStats] = await Promise.all([
      Content.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            createdAt: { $gte: cutoffDate }
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            types: { $push: '$type' }
          }
        }
      ]),
      ScheduledPost.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            status: 'posted',
            postedAt: { $gte: cutoffDate }
          }
        },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 },
            avgEngagement: { $avg: '$analytics.engagement' },
            totalEngagement: { $sum: '$analytics.engagement' }
          }
        }
      ])
    ]);

    // Map to clients
    const benchmarking = {
      timeframe: `${days} days`,
      clients: [],
      averages: {
        contentPerClient: 0,
        postsPerClient: 0,
        avgEngagement: 0
      },
      topPerformers: {
        content: [],
        engagement: []
      }
    };

    for (const client of clients) {
      const clientMemberIds = client.members.map(m => m.userId);
      const clientContent = contentStats.filter(c => clientMemberIds.includes(c._id.toString()));
      const clientContentCount = clientContent.reduce((sum, c) => sum + c.count, 0);

      const clientPosts = await ScheduledPost.countDocuments({
        userId: { $in: clientMemberIds },
        status: 'posted',
        postedAt: { $gte: cutoffDate }
      });

      const clientEngagement = await ScheduledPost.aggregate([
        {
          $match: {
            userId: { $in: clientMemberIds },
            status: 'posted',
            postedAt: { $gte: cutoffDate }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$analytics.engagement' },
            avg: { $avg: '$analytics.engagement' }
          }
        }
      ]);

      const engagement = clientEngagement[0] || { total: 0, avg: 0 };

      benchmarking.clients.push({
        clientId: client._id,
        clientName: client.name,
        contentCount: clientContentCount,
        postsCount: clientPosts,
        engagement: {
          total: engagement.total || 0,
          average: engagement.avg || 0
        },
        performance: {
          score: calculatePerformanceScore(clientContentCount, clientPosts, engagement.avg || 0),
          rank: 0 // Will be set after sorting
        }
      });
    }

    // Calculate averages
    const totalContent = benchmarking.clients.reduce((sum, c) => sum + c.contentCount, 0);
    const totalPosts = benchmarking.clients.reduce((sum, c) => sum + c.postsCount, 0);
    const totalEngagement = benchmarking.clients.reduce((sum, c) => sum + c.engagement.total, 0);

    benchmarking.averages = {
      contentPerClient: benchmarking.clients.length > 0 ? totalContent / benchmarking.clients.length : 0,
      postsPerClient: benchmarking.clients.length > 0 ? totalPosts / benchmarking.clients.length : 0,
      avgEngagement: benchmarking.clients.length > 0 ? totalEngagement / benchmarking.clients.length : 0
    };

    // Sort and rank
    benchmarking.clients.sort((a, b) => b.performance.score - a.performance.score);
    benchmarking.clients.forEach((client, index) => {
      client.performance.rank = index + 1;
    });

    // Top performers
    benchmarking.topPerformers.content = benchmarking.clients
      .sort((a, b) => b.contentCount - a.contentCount)
      .slice(0, 5)
      .map(c => ({ name: c.clientName, count: c.contentCount }));

    benchmarking.topPerformers.engagement = benchmarking.clients
      .sort((a, b) => b.engagement.average - a.engagement.average)
      .slice(0, 5)
      .map(c => ({ name: c.clientName, average: c.engagement.average }));

    return benchmarking;
  } catch (error) {
    logger.error('Error getting cross-client benchmarking', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(contentCount, postsCount, avgEngagement) {
  // Weighted score: content (30%), posts (30%), engagement (40%)
  const contentScore = Math.min(contentCount / 100, 1) * 30;
  const postsScore = Math.min(postsCount / 200, 1) * 30;
  const engagementScore = Math.min(avgEngagement / 1000, 1) * 40;
  return contentScore + postsScore + engagementScore;
}

/**
 * Get agency dashboard overview
 */
async function getAgencyDashboard(agencyWorkspaceId) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      throw new Error('Agency workspace not found');
    }

    // Get all clients
    const clients = await Workspace.find({
      type: 'client',
      'members.userId': agency.ownerId
    }).lean();

    // Get portals
    const portals = await WhiteLabelPortal.find({
      workspaceId: agencyWorkspaceId
    }).lean();

    // Get recent activity
    const { getAuditLogAnalytics } = require('./workspaceService');
    const activity = await getAuditLogAnalytics(agencyWorkspaceId, '7days');

    // Get cross-client benchmarking
    const benchmarking = await getCrossClientBenchmarking(agencyWorkspaceId, '30days');

    return {
      agency: {
        id: agency._id,
        name: agency.name,
        memberCount: agency.members.length
      },
      clients: {
        total: clients.length,
        active: clients.filter(c => c.isActive).length,
        list: clients.map(c => ({
          id: c._id,
          name: c.name,
          memberCount: c.members.length,
          isActive: c.isActive
        }))
      },
      portals: {
        total: portals.length,
        active: portals.filter(p => p.isActive).length,
        list: portals.map(p => ({
          id: p._id,
          subdomain: p.subdomain,
          clientId: p.clientId,
          isActive: p.isActive
        }))
      },
      activity: {
        totalActions: activity.totalActions,
        topActions: activity.topActions.slice(0, 5),
        trends: activity.trends
      },
      benchmarking: {
        clients: benchmarking.clients.length,
        topPerformer: benchmarking.topPerformers.engagement[0]?.name || null,
        avgEngagement: benchmarking.averages.avgEngagement
      }
    };
  } catch (error) {
    logger.error('Error getting agency dashboard', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Start client onboarding
 */
async function startClientOnboarding(agencyWorkspaceId, clientData) {
  try {
    const ClientOnboarding = require('../models/ClientOnboarding');
    const { createWorkspace } = require('./workspaceService');
    const { createWhiteLabelPortal } = require('./agencyService');

    const {
      clientName,
      clientEmail,
      clientIndustry,
      onboardingTemplate = 'standard',
      settings = {}
    } = clientData;

    // Create client workspace
    const clientWorkspace = await createWorkspace(null, {
      name: clientName,
      type: 'client',
      metadata: {
        industry: clientIndustry,
        clientEmail
      }
    });

    // Create onboarding record
    const onboarding = new ClientOnboarding({
      agencyWorkspaceId,
      clientWorkspaceId: clientWorkspace._id,
      status: 'in_progress',
      currentStep: 0,
      steps: getOnboardingSteps(onboardingTemplate),
      settings: {
        autoProceed: settings.autoProceed !== false,
        sendNotifications: settings.sendNotifications !== false,
        createPortal: settings.createPortal !== false,
        setupWorkflows: settings.setupWorkflows !== false
      },
      metadata: {
        clientName,
        clientEmail,
        clientIndustry,
        onboardingTemplate
      }
    });

    await onboarding.save();

    // Start first step
    await executeOnboardingStep(onboarding._id, 0);

    logger.info('Client onboarding started', { agencyWorkspaceId, clientWorkspaceId: clientWorkspace._id });
    return { onboarding, clientWorkspace };
  } catch (error) {
    logger.error('Error starting client onboarding', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get onboarding steps for template
 */
function getOnboardingSteps(template) {
  const templates = {
    standard: [
      { stepNumber: 1, name: 'Create Workspace', action: 'create_workspace', status: 'completed' },
      { stepNumber: 2, name: 'Invite Members', action: 'invite_members', status: 'pending' },
      { stepNumber: 3, name: 'Setup Portal', action: 'setup_portal', status: 'pending' },
      { stepNumber: 4, name: 'Configure Branding', action: 'configure_branding', status: 'pending' },
      { stepNumber: 5, name: 'Setup Workflows', action: 'setup_workflows', status: 'pending' },
      { stepNumber: 6, name: 'Send Welcome', action: 'send_welcome', status: 'pending' }
    ],
    quick: [
      { stepNumber: 1, name: 'Create Workspace', action: 'create_workspace', status: 'completed' },
      { stepNumber: 2, name: 'Setup Portal', action: 'setup_portal', status: 'pending' },
      { stepNumber: 3, name: 'Send Welcome', action: 'send_welcome', status: 'pending' }
    ],
    full: [
      { stepNumber: 1, name: 'Create Workspace', action: 'create_workspace', status: 'completed' },
      { stepNumber: 2, name: 'Invite Members', action: 'invite_members', status: 'pending' },
      { stepNumber: 3, name: 'Setup Portal', action: 'setup_portal', status: 'pending' },
      { stepNumber: 4, name: 'Configure Branding', action: 'configure_branding', status: 'pending' },
      { stepNumber: 5, name: 'Import Content', action: 'import_content', status: 'pending' },
      { stepNumber: 6, name: 'Setup Workflows', action: 'setup_workflows', status: 'pending' },
      { stepNumber: 7, name: 'Create Approvals', action: 'create_approvals', status: 'pending' },
      { stepNumber: 8, name: 'Schedule Demo', action: 'schedule_demo', status: 'pending' },
      { stepNumber: 9, name: 'Send Welcome', action: 'send_welcome', status: 'pending' }
    ]
  };

  return templates[template] || templates.standard;
}

/**
 * Execute onboarding step
 */
async function executeOnboardingStep(onboardingId, stepNumber) {
  try {
    const ClientOnboarding = require('../models/ClientOnboarding');
    const onboarding = await ClientOnboarding.findById(onboardingId);
    if (!onboarding) {
      throw new Error('Onboarding not found');
    }

    const step = onboarding.steps.find(s => s.stepNumber === stepNumber + 1);
    if (!step) {
      onboarding.status = 'completed';
      onboarding.completedAt = new Date();
      await onboarding.save();
      return { completed: true };
    }

    step.status = 'in_progress';
    onboarding.currentStep = stepNumber + 1;
    await onboarding.save();

    // Execute step action
    let result;
    switch (step.action) {
      case 'invite_members':
        // Invite client members
        result = { success: true };
        break;
      case 'setup_portal':
        // Create white-label portal
        const portal = await createWhiteLabelPortal(
          onboarding.agencyWorkspaceId,
          onboarding.clientWorkspaceId,
          { subdomain: onboarding.metadata.clientName.toLowerCase().replace(/\s+/g, '-') }
        );
        result = { success: true, portalId: portal._id };
        break;
      case 'configure_branding':
        // Configure branding
        result = { success: true };
        break;
      case 'setup_workflows':
        // Setup default workflows
        result = { success: true };
        break;
      case 'send_welcome':
        // Send welcome email
        result = { success: true };
        break;
      default:
        result = { success: true };
    }

    step.status = 'completed';
    step.completedAt = new Date();
    onboarding.currentStep = stepNumber + 1;

    // Auto-proceed to next step
    if (onboarding.settings.autoProceed && stepNumber + 1 < onboarding.steps.length) {
      await executeOnboardingStep(onboardingId, stepNumber + 1);
    } else {
      onboarding.status = onboarding.currentStep >= onboarding.steps.length ? 'completed' : 'in_progress';
      if (onboarding.status === 'completed') {
        onboarding.completedAt = new Date();
      }
    }

    await onboarding.save();
    return result;
  } catch (error) {
    logger.error('Error executing onboarding step', { error: error.message, onboardingId, stepNumber });
    throw error;
  }
}

/**
 * Generate white-label client report
 */
async function generateClientReport(agencyWorkspaceId, clientWorkspaceId, reportData) {
  try {
    const ClientReport = require('../models/ClientReport');
    const {
      reportType = 'monthly',
      period,
      branding = {},
      sections = []
    } = reportData;

    const { startDate, endDate } = period || getDefaultPeriod(reportType);

    // Get client data
    const client = await Workspace.findById(clientWorkspaceId);
    const memberIds = client.members.map(m => m.userId);

    // Get content and post data
    const [contentStats, postStats] = await Promise.all([
      Content.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ]),
      ScheduledPost.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            status: 'posted',
            postedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$platform',
            count: { $sum: 1 },
            totalEngagement: { $sum: '$analytics.engagement' },
            avgEngagement: { $avg: '$analytics.engagement' }
          }
        }
      ])
    ]);

    // Calculate metrics
    const totalPosts = postStats.reduce((sum, p) => sum + p.count, 0);
    const totalEngagement = postStats.reduce((sum, p) => sum + (p.totalEngagement || 0), 0);
    const avgEngagement = totalPosts > 0 ? totalEngagement / totalPosts : 0;
    const contentCreated = contentStats.reduce((sum, c) => sum + c.count, 0);

    // Get previous period for growth
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    const prevEndDate = new Date(endDate);
    prevEndDate.setMonth(prevEndDate.getMonth() - 1);

    const prevPostStats = await ScheduledPost.aggregate([
      {
        $match: {
          userId: { $in: memberIds },
          status: 'posted',
          postedAt: { $gte: prevStartDate, $lte: prevEndDate }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          engagement: { $sum: '$analytics.engagement' }
        }
      }
    ]);

    const prevTotal = prevPostStats[0]?.total || 0;
    const growthRate = prevTotal > 0 ? ((totalPosts - prevTotal) / prevTotal) * 100 : 0;

    // Generate insights
    const insights = generateInsights(totalPosts, totalEngagement, avgEngagement, growthRate, postStats);

    // Create report
    const report = new ClientReport({
      agencyWorkspaceId,
      clientWorkspaceId,
      reportType,
      period: { startDate, endDate },
      branding: {
        logo: branding.logo,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        customCSS: branding.customCSS
      },
      sections: sections.length > 0 ? sections : getDefaultSections(contentStats, postStats),
      metrics: {
        totalPosts,
        totalEngagement,
        avgEngagement,
        topPlatform: postStats.sort((a, b) => b.count - a.count)[0]?._id || null,
        contentCreated,
        growthRate
      },
      insights,
      status: 'generated',
      generatedAt: new Date()
    });

    await report.save();

    logger.info('Client report generated', { agencyWorkspaceId, clientWorkspaceId, reportId: report._id });
    return report;
  } catch (error) {
    logger.error('Error generating client report', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get default period for report type
 */
function getDefaultPeriod(reportType) {
  const endDate = new Date();
  const startDate = new Date();

  switch (reportType) {
    case 'weekly':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'monthly':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarterly':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    default:
      startDate.setMonth(startDate.getMonth() - 1);
  }

  return { startDate, endDate };
}

/**
 * Get default report sections
 */
function getDefaultSections(contentStats, postStats) {
  return [
    {
      sectionType: 'overview',
      title: 'Overview',
      order: 1,
      data: { contentStats, postStats }
    },
    {
      sectionType: 'platforms',
      title: 'Platform Performance',
      order: 2,
      data: { platforms: postStats }
    },
    {
      sectionType: 'top_posts',
      title: 'Top Performing Posts',
      order: 3,
      data: { limit: 10 }
    },
    {
      sectionType: 'recommendations',
      title: 'Recommendations',
      order: 4,
      data: {}
    }
  ];
}

/**
 * Generate insights
 */
function generateInsights(totalPosts, totalEngagement, avgEngagement, growthRate, postStats) {
  const insights = [];

  if (growthRate > 20) {
    insights.push({
      type: 'success',
      title: 'Strong Growth',
      description: `Post volume increased by ${growthRate.toFixed(1)}%`,
      recommendation: 'Continue current strategy and consider scaling successful content types'
    });
  }

  if (avgEngagement > 1000) {
    insights.push({
      type: 'success',
      title: 'High Engagement',
      description: `Average engagement of ${avgEngagement.toFixed(0)} per post`,
      recommendation: 'Leverage high-performing content formats and posting times'
    });
  }

  const topPlatform = postStats.sort((a, b) => b.count - a.count)[0];
  if (topPlatform) {
    insights.push({
      type: 'info',
      title: 'Top Platform',
      description: `${topPlatform._id} generated the most posts`,
      recommendation: `Consider increasing presence on ${topPlatform._id}`
    });
  }

  if (totalPosts < 10) {
    insights.push({
      type: 'warning',
      title: 'Low Post Volume',
      description: 'Consider increasing posting frequency',
      recommendation: 'Aim for at least 3-5 posts per week per platform'
    });
  }

  return insights;
}

/**
 * Track client usage and billing
 */
async function trackClientUsage(agencyWorkspaceId, clientWorkspaceId, period = null) {
  try {
    const ClientBilling = require('../models/ClientBilling');
    
    const now = new Date();
    const billingPeriod = period || {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      month: now.getMonth() + 1,
      year: now.getFullYear()
    };

    const client = await Workspace.findById(clientWorkspaceId);
    const memberIds = client.members.map(m => m.userId);

    // Calculate usage
    const [contentCount, postsPublished, postsScheduled, workflowsCount] = await Promise.all([
      Content.countDocuments({
        userId: { $in: memberIds },
        createdAt: { $gte: billingPeriod.startDate, $lte: billingPeriod.endDate }
      }),
      ScheduledPost.countDocuments({
        userId: { $in: memberIds },
        status: 'posted',
        postedAt: { $gte: billingPeriod.startDate, $lte: billingPeriod.endDate }
      }),
      ScheduledPost.countDocuments({
        userId: { $in: memberIds },
        status: 'scheduled',
        scheduledTime: { $gte: billingPeriod.startDate, $lte: billingPeriod.endDate }
      }),
      Promise.resolve(0) // Workflows count would come from workflow execution logs
    ]);

    // Get or create billing record
    let billing = await ClientBilling.findOne({
      agencyWorkspaceId,
      clientWorkspaceId,
      'billingPeriod.month': billingPeriod.month,
      'billingPeriod.year': billingPeriod.year
    });

    if (!billing) {
      billing = new ClientBilling({
        agencyWorkspaceId,
        clientWorkspaceId,
        billingPeriod,
        usage: {
          contentCreated: 0,
          postsPublished: 0,
          postsScheduled: 0,
          workflowsExecuted: 0,
          members: client.members.length
        },
        limits: {
          contentCreated: 1000,
          postsPublished: 500,
          postsScheduled: 1000,
          members: 10
        },
        billing: {
          plan: 'professional',
          basePrice: 299,
          currency: 'USD'
        }
      });
    }

    // Update usage
    billing.usage = {
      contentCreated: contentCount,
      postsPublished,
      postsScheduled,
      workflowsExecuted: workflowsCount,
      members: client.members.length,
      apiCalls: 0, // Would track from API logs
      storageUsed: 0 // Would calculate from file storage
    };

    // Calculate billing
    const overage = {
      content: Math.max(0, contentCount - (billing.limits.contentCreated || 0)),
      posts: Math.max(0, postsPublished - (billing.limits.postsPublished || 0))
    };

    billing.billing.usagePrice = (contentCount * 0.1) + (postsPublished * 0.5);
    billing.billing.overagePrice = (overage.content * 0.2) + (overage.posts * 1.0);
    billing.billing.totalPrice = billing.billing.basePrice + billing.billing.usagePrice + billing.billing.overagePrice;

    await billing.save();

    logger.info('Client usage tracked', { agencyWorkspaceId, clientWorkspaceId, period: billingPeriod });
    return billing;
  } catch (error) {
    logger.error('Error tracking client usage', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

/**
 * Get client performance alerts
 */
async function getClientPerformanceAlerts(agencyWorkspaceId, clientWorkspaceId = null) {
  try {
    const agency = await Workspace.findById(agencyWorkspaceId);
    if (!agency || agency.type !== 'agency') {
      throw new Error('Agency workspace not found');
    }

    const clients = clientWorkspaceId
      ? [await Workspace.findById(clientWorkspaceId)]
      : await Workspace.find({
          type: 'client',
          'members.userId': agency.ownerId
        });

    const alerts = [];

    for (const client of clients) {
      if (!client) continue;

      const memberIds = client.members.map(m => m.userId);
      const now = new Date();
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Check posting frequency
      const recentPosts = await ScheduledPost.countDocuments({
        userId: { $in: memberIds },
        status: 'posted',
        postedAt: { $gte: last7Days }
      });

      if (recentPosts < 5) {
        alerts.push({
          type: 'low_activity',
          severity: 'medium',
          clientId: client._id,
          clientName: client.name,
          title: 'Low Posting Activity',
          message: `Only ${recentPosts} posts in the last 7 days`,
          recommendation: 'Increase posting frequency to maintain engagement'
        });
      }

      // Check engagement
      const avgEngagement = await ScheduledPost.aggregate([
        {
          $match: {
            userId: { $in: memberIds },
            status: 'posted',
            postedAt: { $gte: last7Days }
          }
        },
        {
          $group: {
            _id: null,
            avg: { $avg: '$analytics.engagement' }
          }
        }
      ]);

      const engagement = avgEngagement[0]?.avg || 0;
      if (engagement < 100) {
        alerts.push({
          type: 'low_engagement',
          severity: 'high',
          clientId: client._id,
          clientName: client.name,
          title: 'Low Engagement',
          message: `Average engagement is ${engagement.toFixed(0)} per post`,
          recommendation: 'Review content strategy and posting times'
        });
      }

      // Check pending approvals
      const pendingApprovals = await ContentApproval.countDocuments({
        'metadata.clientId': client._id,
        status: 'pending'
      });

      if (pendingApprovals > 10) {
        alerts.push({
          type: 'approval_backlog',
          severity: 'medium',
          clientId: client._id,
          clientName: client.name,
          title: 'Approval Backlog',
          message: `${pendingApprovals} pending approvals`,
          recommendation: 'Review and process pending approvals'
        });
      }
    }

    return alerts;
  } catch (error) {
    logger.error('Error getting client performance alerts', { error: error.message, agencyWorkspaceId });
    throw error;
  }
}

module.exports = {
  createWhiteLabelPortal,
  bulkScheduleAcrossClients,
  bulkImportContent,
  getClientApprovalDashboard,
  getCrossClientBenchmarking,
  getAgencyDashboard,
  startClientOnboarding,
  executeOnboardingStep,
  generateClientReport,
  trackClientUsage,
  getClientPerformanceAlerts
};

