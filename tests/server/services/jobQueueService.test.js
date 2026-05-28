// Job Queue Service Tests

// Mock bullmq and ioredis BEFORE importing jobQueueService
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockImplementation((name, data, opts) => Promise.resolve({
      id: 'test-job-id',
      name,
      data,
      opts,
      getState: jest.fn().mockResolvedValue('waiting'),
      progress: 0,
    })),
    getJob: jest.fn().mockImplementation((jobId) => {
      if (jobId === 'non-existent') return Promise.resolve(null);
      return Promise.resolve({
        id: jobId,
        name: 'test-job',
        data: { test: 'data' },
        getState: jest.fn().mockResolvedValue('active'),
        progress: 50,
        timestamp: Date.now(),
      });
    }),
    getWaitingCount: jest.fn().mockResolvedValue(1),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(5),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    close: jest.fn().mockResolvedValue(),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    })),
    QueueEvents: jest.fn().mockImplementation(() => ({
      close: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    })),
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(),
    disconnect: jest.fn(),
  }));
});

// Set a dummy redis url to bypass dev neutralization shield
process.env.REDIS_URL = 'redis://sandbox-redis:6379';

const { getQueue, addJob, getJobStatus, getQueueStats } = require('../../../server/services/jobQueueService');

describe('Job Queue Service', () => {
  let testQueue;

  beforeAll(() => {
    testQueue = getQueue('test-queue');
  });

  describe('addJob', () => {
    it('should add a job to the queue', async () => {
      const job = await addJob('test-queue', {
        name: 'test-job',
        data: { test: 'data' },
      });

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
    });

    it('should add job with priority', async () => {
      const job = await addJob('test-queue', {
        name: 'priority-job',
        data: { test: 'priority' },
      }, {
        priority: 10,
      });

      expect(job).toBeDefined();
    });
  });

  describe('getJobStatus', () => {
    it('should get job status', async () => {
      const job = await addJob('test-queue', {
        name: 'status-job',
        data: { test: 'status' },
      });

      const status = await getJobStatus('test-queue', job.id);
      expect(status).toBeDefined();
      expect(status.id).toBe(job.id);
    });

    it('should return null for non-existent job', async () => {
      const status = await getJobStatus('test-queue', 'non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should get queue statistics', async () => {
      const stats = await getQueueStats('test-queue');
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
    });
  });
});
