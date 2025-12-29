// Robust Export Service
// Reliable exports with retry logic and clear error messages

const ExportJob = require('../models/ExportJob');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');
const { categorizeExportError, shouldRetry, getRetryDelay } = require('./exportErrorHandler');

/**
 * Create export job
 */
async function createExportJob(userId, exportData) {
  try {
    const job = new ExportJob({
      userId,
      export: exportData,
      status: 'pending',
      progress: {
        total: 0,
        completed: 0,
        percentage: 0,
        stage: 'preparing'
      },
      metadata: {
        startTime: new Date()
      }
    });

    await job.save();

    // Queue export processing
    await queueExportProcessing(job._id);

    return job;
  } catch (error) {
    logger.error('Error creating export job', { error: error.message, userId });
    throw error;
  }
}

/**
 * Process export job
 */
async function processExportJob(jobId) {
  try {
    const job = await ExportJob.findById(jobId);
    if (!job) {
      throw new Error('Export job not found');
    }

    // Update status
    job.status = 'processing';
    job.progress.stage = 'processing';
    await job.save();

    try {
      // Process based on type
      let result;
      switch (job.export.type) {
        case 'content':
          result = await exportContent(job);
          break;
        case 'analytics':
          result = await exportAnalytics(job);
          break;
        case 'reports':
          result = await exportReports(job);
          break;
        case 'assets':
          result = await exportAssets(job);
          break;
        case 'bulk':
          result = await exportBulk(job);
          break;
        default:
          throw new Error(`Unknown export type: ${job.export.type}`);
      }

      // Update job with result
      job.status = 'completed';
      job.result = result;
      job.metadata.endTime = new Date();
      job.metadata.duration = job.metadata.endTime - job.metadata.startTime;
      job.progress.percentage = 100;
      await job.save();

      return job;
    } catch (error) {
      // Handle error with retry logic
      await handleExportError(job, error);
      throw error;
    }
  } catch (error) {
    logger.error('Error processing export job', { error: error.message, jobId });
    throw error;
  }
}

/**
 * Handle export error with retry logic
 */
async function handleExportError(job, error) {
  try {
    // Categorize error for better handling
    const categorized = categorizeExportError(error);

    // Record error with categorized information
    job.error = {
      code: error.code || categorized.category.toUpperCase() + '_ERROR',
      message: categorized.userMessage,
      category: categorized.category,
      severity: categorized.severity,
      retryable: categorized.retryable,
      details: categorized.technicalDetails,
      stack: error.stack,
      timestamp: new Date()
    };

    // Check if should retry based on error category
    const canRetry = shouldRetry(error, job.retry.attempts, job.retry.maxAttempts);

    if (canRetry && categorized.retryable) {
      job.retry.attempts++;
      job.retry.lastAttempt = new Date();
      
      // Calculate next retry with smart backoff based on error type
      const delayMs = getRetryDelay(error, job.retry.attempts, 1000);
      job.retry.nextRetry = new Date(Date.now() + delayMs);
      job.status = 'pending'; // Retry

      await job.save();

      // Queue retry
      await queueExportProcessing(job._id, job.retry.nextRetry);

      logger.info('Export job queued for retry', {
        jobId: job._id,
        attempt: job.retry.attempts,
        category: categorized.category,
        nextRetry: job.retry.nextRetry,
        delay: delayMs
      });
    } else {
      // Max retries reached or non-retryable error
      job.status = 'failed';
      await job.save();

      logger.error('Export job failed', {
        jobId: job._id,
        attempts: job.retry.attempts,
        category: categorized.category,
        retryable: categorized.retryable,
        error: job.error.message
      });
    }
  } catch (err) {
    logger.error('Error handling export error', { error: err.message, jobId: job._id });
    // Fallback: mark as failed
    job.status = 'failed';
    job.error = {
      code: 'HANDLER_ERROR',
      message: 'An error occurred while processing the export error. Please contact support.',
      timestamp: new Date()
    };
    await job.save();
  }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
  // Map technical errors to user-friendly messages
  const errorMessages = {
    'ENOENT': 'File not found. Please try again.',
    'EACCES': 'Permission denied. Please contact support.',
    'ENOSPC': 'Insufficient storage. Please free up space.',
    'ETIMEDOUT': 'Export timed out. Please try again.',
    'ECONNREFUSED': 'Connection refused. Please check your connection.',
    'AI_ERROR': 'AI processing failed. The AI service encountered an error while processing your content. Please try again in a few moments. If the problem persists, contact support.',
    'AI_TIMEOUT': 'AI processing timed out. The content is taking longer than expected to process. Please try again or reduce the content size.',
    'AI_QUOTA_EXCEEDED': 'AI processing quota exceeded. You have reached your AI processing limit. Please upgrade your plan or wait for your quota to reset.',
    'AI_RATE_LIMIT': 'AI processing rate limit reached. Too many requests. Please wait a moment and try again.',
    'AI_SERVICE_UNAVAILABLE': 'AI service is temporarily unavailable. Please try again in a few minutes.',
    'PUBLISHING_ERROR': 'Publishing failed. Unable to publish to the selected platform. Please check your platform connection and try again.',
    'PUBLISHING_AUTH_ERROR': 'Publishing authentication failed. Your platform connection may have expired. Please reconnect your account in settings.',
    'PUBLISHING_RATE_LIMIT': 'Publishing rate limit reached. Too many posts in a short time. Please wait before publishing again.',
    'PUBLISHING_VALIDATION_ERROR': 'Publishing validation failed. Your content does not meet platform requirements. Please review and adjust your content.',
    'PUBLISHING_SERVICE_UNAVAILABLE': 'Publishing service is temporarily unavailable. Please try again in a few minutes.',
    'FORMAT_ERROR': 'Format conversion failed. Unable to convert to the selected format. Please try a different format.',
    'QUOTA_EXCEEDED': 'Export quota exceeded. You have reached your export limit. Please upgrade your plan.',
    'VALIDATION_ERROR': 'Export data validation failed. Please check your filters and try again.',
    'NETWORK_ERROR': 'Network error occurred. Please check your internet connection and try again.',
    'STORAGE_ERROR': 'Storage error. Unable to save export file. Please contact support if this persists.'
  };

  // Check for specific error codes
  if (error.code && errorMessages[error.code]) {
    return errorMessages[error.code];
  }

  // Check for error type in message (case insensitive)
  const errorMessageLower = error.message?.toLowerCase() || '';
  for (const [key, message] of Object.entries(errorMessages)) {
    if (errorMessageLower.includes(key.toLowerCase())) {
      return message;
    }
  }

  // Check for AI-specific errors
  if (errorMessageLower.includes('ai') || errorMessageLower.includes('openai') || errorMessageLower.includes('gpt')) {
    if (errorMessageLower.includes('timeout') || errorMessageLower.includes('timed out')) {
      return errorMessages.AI_TIMEOUT;
    }
    if (errorMessageLower.includes('quota') || errorMessageLower.includes('limit')) {
      return errorMessages.AI_QUOTA_EXCEEDED;
    }
    if (errorMessageLower.includes('rate limit')) {
      return errorMessages.AI_RATE_LIMIT;
    }
    return errorMessages.AI_ERROR;
  }

  // Check for publishing-specific errors
  if (errorMessageLower.includes('publish') || errorMessageLower.includes('post')) {
    if (errorMessageLower.includes('auth') || errorMessageLower.includes('token') || errorMessageLower.includes('expired')) {
      return errorMessages.PUBLISHING_AUTH_ERROR;
    }
    if (errorMessageLower.includes('rate limit')) {
      return errorMessages.PUBLISHING_RATE_LIMIT;
    }
    if (errorMessageLower.includes('validation') || errorMessageLower.includes('invalid')) {
      return errorMessages.PUBLISHING_VALIDATION_ERROR;
    }
    return errorMessages.PUBLISHING_ERROR;
  }

  // Default message with actionable guidance
  return error.message || 'An unexpected error occurred. Please try again in a few moments. If the problem persists, contact support with the error code: ' + (error.code || 'UNKNOWN');
}

/**
 * Export content
 */
async function exportContent(job) {
  // Would implement actual content export
  // For now, return placeholder
  return {
    fileUrl: `/exports/${job._id}.${job.export.format}`,
    fileSize: 0,
    fileName: `content-export-${Date.now()}.${job.export.format}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  };
}

/**
 * Export analytics
 */
async function exportAnalytics(job) {
  // Would implement actual analytics export
  return {
    fileUrl: `/exports/${job._id}.${job.export.format}`,
    fileSize: 0,
    fileName: `analytics-export-${Date.now()}.${job.export.format}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

/**
 * Export reports
 */
async function exportReports(job) {
  // Would implement actual reports export
  return {
    fileUrl: `/exports/${job._id}.${job.export.format}`,
    fileSize: 0,
    fileName: `reports-export-${Date.now()}.${job.export.format}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

/**
 * Export assets
 */
async function exportAssets(job) {
  // Would implement actual assets export
  return {
    fileUrl: `/exports/${job._id}.zip`,
    fileSize: 0,
    fileName: `assets-export-${Date.now()}.zip`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

/**
 * Export bulk
 */
async function exportBulk(job) {
  // Would implement actual bulk export
  return {
    fileUrl: `/exports/${job._id}.zip`,
    fileSize: 0,
    fileName: `bulk-export-${Date.now()}.zip`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  };
}

/**
 * Queue export processing
 */
async function queueExportProcessing(jobId, scheduledTime = null) {
  // Would integrate with job queue (BullMQ, etc.)
  // For now, process immediately
  if (!scheduledTime || scheduledTime <= new Date()) {
    // Process immediately
    processExportJob(jobId).catch(err => {
      logger.error('Error in queued export processing', { error: err.message, jobId });
    });
  } else {
    // Schedule for later
    const delay = scheduledTime.getTime() - Date.now();
    setTimeout(() => {
      processExportJob(jobId).catch(err => {
        logger.error('Error in scheduled export processing', { error: err.message, jobId });
      });
    }, delay);
  }
}

/**
 * Get export job status
 */
async function getExportJobStatus(jobId, userId) {
  try {
    const job = await ExportJob.findOne({ _id: jobId, userId }).lean();
    if (!job) {
      throw new Error('Export job not found');
    }

    return {
      status: job.status,
      progress: job.progress,
      error: job.error ? {
        message: job.error.message,
        code: job.error.code,
        canRetry: job.retry.attempts < job.retry.maxAttempts
      } : null,
      result: job.result,
      retry: {
        attempts: job.retry.attempts,
        maxAttempts: job.retry.maxAttempts,
        nextRetry: job.retry.nextRetry
      }
    };
  } catch (error) {
    logger.error('Error getting export job status', { error: error.message, jobId });
    throw error;
  }
}

/**
 * Retry failed export
 */
async function retryExport(jobId, userId) {
  try {
    const job = await ExportJob.findOne({ _id: jobId, userId });
    if (!job) {
      throw new Error('Export job not found');
    }

    if (job.status !== 'failed') {
      throw new Error('Can only retry failed exports');
    }

    // Reset for retry
    job.status = 'pending';
    job.error = null;
    job.retry.attempts = 0;
    job.retry.nextRetry = null;
    await job.save();

    // Queue processing
    await queueExportProcessing(job._id);

    return job;
  } catch (error) {
    logger.error('Error retrying export', { error: error.message, jobId });
    throw error;
  }
}

module.exports = {
  createExportJob,
  processExportJob,
  getExportJobStatus,
  retryExport
};

