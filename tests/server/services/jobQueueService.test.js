// Job Queue Service Tests

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






