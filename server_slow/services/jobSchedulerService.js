// Job scheduling service

const { addJob } = require('./jobQueueService');
const logger = require('../utils/logger');

/**
 * Schedule a job for future execution
 */
async function scheduleJob(queueName, jobData, scheduledTime, options = {}) {
  try {
    const now = Date.now();
    const scheduled = new Date(scheduledTime).getTime();
    const delay = Math.max(0, scheduled - now);

    if (delay === 0) {
      // Execute immediately
      return await addJob(queueName, jobData, options);
    }

    // Schedule for future
    return await addJob(queueName, jobData, {
      ...options,
      delay,
    });
  } catch (error) {
    logger.error('Schedule job error', { error: error.message, queueName });
    throw error;
  }
}

/**
 * Schedule recurring job (cron-like)
 */
async function scheduleRecurringJob(queueName, jobData, cronExpression, options = {}) {
  try {
    const cron = require('node-cron');
    
    if (!cron.validate(cronExpression)) {
      throw new Error('Invalid cron expression');
    }

    // Schedule the job
    cron.schedule(cronExpression, async () => {
      try {
        await addJob(queueName, jobData, options);
        logger.info('Recurring job executed', { queueName, cronExpression });
      } catch (error) {
        logger.error('Recurring job execution error', {
          queueName,
          cronExpression,
          error: error.message,
        });
      }
    });

    logger.info('Recurring job scheduled', { queueName, cronExpression });
    return true;
  } catch (error) {
    logger.error('Schedule recurring job error', { error: error.message, queueName });
    throw error;
  }
}

/**
 * Schedule job at specific time
 */
async function scheduleAt(queueName, jobData, dateTime, options = {}) {
  return scheduleJob(queueName, jobData, dateTime, options);
}

/**
 * Schedule job after delay
 */
async function scheduleAfter(queueName, jobData, delayMs, options = {}) {
  return addJob(queueName, jobData, {
    ...options,
    delay: delayMs,
  });
}

module.exports = {
  scheduleJob,
  scheduleRecurringJob,
  scheduleAt,
  scheduleAfter,
};






