// Job Dependency Service
// Handles job dependencies and chaining

const { addJob, getJobStatus } = require('./jobQueueService');
const { QUEUE_NAMES } = require('../queues');
const logger = require('../utils/logger');

/**
 * Add a job that depends on another job completing
 */
async function addDependentJob(dependentJob, parentJobId, parentQueueName, options = {}) {
  try {
    // Check if parent job is already completed
    const parentStatus = await getJobStatus(parentQueueName, parentJobId);
    
    if (parentStatus && parentStatus.state === 'completed') {
      // Parent already completed, add dependent job immediately
      return await addJob(dependentJob.queueName, {
        name: dependentJob.name,
        data: dependentJob.data,
      }, {
        ...options,
        priority: options.priority || 0,
      });
    }

    // Parent not completed, store dependency and wait
    const JobDependency = require('../models/JobDependency');
    await JobDependency.create({
      parentJobId,
      parentQueueName,
      dependentJob: {
        queueName: dependentJob.queueName,
        name: dependentJob.name,
        data: dependentJob.data,
        options,
      },
      status: 'pending',
    });

    logger.info('Dependent job registered', {
      parentJobId,
      dependentQueue: dependentJob.queueName,
    });

    return { dependencyId: parentJobId, status: 'pending' };
  } catch (error) {
    logger.error('Failed to add dependent job', { error: error.message });
    throw error;
  }
}

/**
 * Process job dependencies when parent job completes
 */
async function processJobDependencies(parentJobId, parentQueueName) {
  try {
    const JobDependency = require('../models/JobDependency');
    const dependencies = await JobDependency.find({
      parentJobId,
      parentQueueName,
      status: 'pending',
    });

    for (const dependency of dependencies) {
      try {
        const job = await addJob(
          dependency.dependentJob.queueName,
          {
            name: dependency.dependentJob.name,
            data: dependency.dependentJob.data,
          },
          dependency.dependentJob.options || {}
        );

        await JobDependency.findByIdAndUpdate(dependency._id, {
          $set: {
            status: 'completed',
            dependentJobId: job.id,
            completedAt: new Date(),
          },
        });

        logger.info('Dependent job started', {
          parentJobId,
          dependentJobId: job.id,
        });
      } catch (error) {
        logger.error('Failed to start dependent job', {
          dependencyId: dependency._id,
          error: error.message,
        });

        await JobDependency.findByIdAndUpdate(dependency._id, {
          $set: {
            status: 'failed',
            error: error.message,
          },
        });
      }
    }
  } catch (error) {
    logger.error('Failed to process job dependencies', { error: error.message });
  }
}

/**
 * Chain multiple jobs together
 */
async function chainJobs(jobs, options = {}) {
  try {
    if (jobs.length === 0) {
      throw new Error('No jobs provided for chaining');
    }

    const results = [];
    let previousJob = null;

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];

      if (i === 0) {
        // First job - add immediately
        const firstJob = await addJob(job.queueName, {
          name: job.name,
          data: job.data,
        }, {
          ...options,
          ...job.options,
        });
        previousJob = { id: firstJob.id, queueName: job.queueName };
        results.push(firstJob);
      } else {
        // Subsequent jobs - depend on previous
        const dependent = await addDependentJob(
          job,
          previousJob.id,
          previousJob.queueName,
          {
            ...options,
            ...job.options,
          }
        );
        results.push(dependent);
        previousJob = { id: dependent.id || previousJob.id, queueName: job.queueName };
      }
    }

    return results;
  } catch (error) {
    logger.error('Failed to chain jobs', { error: error.message });
    throw error;
  }
}

module.exports = {
  addDependentJob,
  processJobDependencies,
  chainJobs,
};



