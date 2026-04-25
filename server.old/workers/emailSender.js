// Email sending worker

const { createWorker } = require('../services/jobQueueService');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Email sending job processor
 */
async function processEmailJob(jobData, job) {
  const { to, subject, template, data } = jobData;

  try {
    await job.updateProgress(10);

    logger.info('Sending email', {
      to,
      subject,
      jobId: job.id,
    });

    // Send email
    await sendEmail(to, subject, template, data);

    await job.updateProgress(100);
    logger.info('Email sent successfully', {
      to,
      jobId: job.id,
    });

    return { success: true, to };
  } catch (error) {
    logger.error('Email sending job failed', {
      to,
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Initialize email sending worker
 */
function initializeEmailWorker() {
  const worker = createWorker('email-sending', processEmailJob, {
    concurrency: 10, // Send 10 emails concurrently
    limiter: {
      max: 100,
      duration: 60000, // Max 100 emails per minute
    },
  });

  logger.info('Email sending worker initialized');
  return worker;
}

module.exports = {
  initializeEmailWorker,
  processEmailJob,
};






