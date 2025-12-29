// Export Enhancement Service
// Scheduled exports, templates, history, analytics

const ExportTemplate = require('../models/ExportTemplate');
const ExportJob = require('../models/ExportJob');
const { createExportJob } = require('./robustExportService');
const logger = require('../utils/logger');

/**
 * Create export template
 */
async function createExportTemplate(userId, templateData) {
  try {
    const template = new ExportTemplate({
      userId,
      name: templateData.name,
      description: templateData.description,
      template: templateData.template,
      schedule: templateData.schedule || { enabled: false },
      sharing: templateData.sharing || { isPublic: false, sharedWith: [] }
    });

    await template.save();
    return template;
  } catch (error) {
    logger.error('Error creating export template', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get export templates
 */
async function getExportTemplates(userId, includeShared = true) {
  try {
    const query = {
      $or: [
        { userId },
        ...(includeShared ? [{ 'sharing.sharedWith.userId': userId }] : [])
      ],
      isActive: true
    };

    const templates = await ExportTemplate.find(query)
      .populate('sharing.sharedWith.userId', 'name email')
      .sort({ 'stats.timesUsed': -1, createdAt: -1 })
      .lean();

    return templates;
  } catch (error) {
    logger.error('Error getting export templates', { error: error.message, userId });
    throw error;
  }
}

/**
 * Use export template
 */
async function useExportTemplate(templateId, userId, overrides = {}) {
  try {
    const template = await ExportTemplate.findById(templateId).lean();
    if (!template) {
      throw new Error('Template not found');
    }

    // Check permissions
    if (template.userId.toString() !== userId.toString() && 
        !template.sharing.sharedWith.some(s => s.userId.toString() === userId.toString())) {
      throw new Error('No permission to use this template');
    }

    // Merge template with overrides
    const exportData = {
      type: overrides.type || template.template.type,
      format: overrides.format || template.template.format,
      filters: { ...template.template.filters, ...(overrides.filters || {}) },
      options: { ...template.template.options, ...(overrides.options || {}) }
    };

    // Create export job
    const job = await createExportJob(userId, exportData);

    // Update template stats
    await ExportTemplate.findByIdAndUpdate(templateId, {
      $inc: { 'stats.timesUsed': 1 },
      $set: { 'stats.lastUsed': new Date() }
    });

    return job;
  } catch (error) {
    logger.error('Error using export template', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Get export history
 */
async function getExportHistory(userId, filters = {}) {
  try {
    const {
      startDate = null,
      endDate = null,
      status = null,
      type = null,
      format = null,
      limit = 50
    } = filters;

    const query = { userId };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (status) query.status = status;
    if (type) query['export.type'] = type;
    if (format) query['export.format'] = format;

    const history = await ExportJob.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return history;
  } catch (error) {
    logger.error('Error getting export history', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get export analytics
 */
async function getExportAnalytics(userId, period = 'month') {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const exports = await ExportJob.find({
      userId,
      createdAt: { $gte: startDate }
    }).lean();

    const analytics = {
      total: exports.length,
      byStatus: {
        completed: exports.filter(e => e.status === 'completed').length,
        failed: exports.filter(e => e.status === 'failed').length,
        processing: exports.filter(e => e.status === 'processing').length,
        pending: exports.filter(e => e.status === 'pending').length
      },
      byType: {},
      byFormat: {},
      successRate: exports.length > 0
        ? Math.round((exports.filter(e => e.status === 'completed').length / exports.length) * 100)
        : 0,
      averageSize: 0,
      totalSize: 0,
      retryRate: exports.length > 0
        ? Math.round((exports.filter(e => e.retry.attempts > 0).length / exports.length) * 100)
        : 0
    };

    // Group by type
    exports.forEach(exp => {
      const type = exp.export.type;
      analytics.byType[type] = (analytics.byType[type] || 0) + 1;
    });

    // Group by format
    exports.forEach(exp => {
      const format = exp.export.format;
      analytics.byFormat[format] = (analytics.byFormat[format] || 0) + 1;
    });

    // Calculate sizes
    const completedExports = exports.filter(e => e.status === 'completed' && e.result?.fileSize);
    if (completedExports.length > 0) {
      const totalSize = completedExports.reduce((sum, e) => sum + (e.result.fileSize || 0), 0);
      analytics.totalSize = totalSize;
      analytics.averageSize = Math.round(totalSize / completedExports.length);
    }

    return analytics;
  } catch (error) {
    logger.error('Error getting export analytics', { error: error.message, userId });
    throw error;
  }
}

/**
 * Schedule export
 */
async function scheduleExport(templateId, userId, scheduleData) {
  try {
    const template = await ExportTemplate.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Update schedule
    template.schedule = {
      enabled: true,
      frequency: scheduleData.frequency,
      dayOfWeek: scheduleData.dayOfWeek,
      dayOfMonth: scheduleData.dayOfMonth,
      time: scheduleData.time,
      timezone: scheduleData.timezone || 'UTC',
      nextRun: calculateNextRun(scheduleData)
    };

    await template.save();

    // Schedule job (would integrate with cron/scheduler)
    await scheduleExportJob(templateId, template.schedule.nextRun);

    return template;
  } catch (error) {
    logger.error('Error scheduling export', { error: error.message, templateId });
    throw error;
  }
}

/**
 * Calculate next run time
 */
function calculateNextRun(schedule) {
  const now = new Date();
  const [hours, minutes] = schedule.time.split(':').map(Number);
  
  let nextRun = new Date();
  nextRun.setHours(hours, minutes, 0, 0);

  switch (schedule.frequency) {
    case 'daily':
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;
    case 'weekly':
      const daysUntil = (schedule.dayOfWeek - nextRun.getDay() + 7) % 7;
      nextRun.setDate(nextRun.getDate() + (daysUntil || 7));
      break;
    case 'monthly':
      nextRun.setDate(schedule.dayOfMonth);
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }
      break;
  }

  return nextRun;
}

/**
 * Schedule export job (placeholder)
 */
async function scheduleExportJob(templateId, nextRun) {
  // Would integrate with cron/scheduler (node-cron, BullMQ, etc.)
  logger.info('Export job scheduled', { templateId, nextRun });
}

module.exports = {
  createExportTemplate,
  getExportTemplates,
  useExportTemplate,
  getExportHistory,
  getExportAnalytics,
  scheduleExport
};


