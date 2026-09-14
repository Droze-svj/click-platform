const digitalTwinService = require('../../server/services/digitalTwinService');

describe('digitalTwinService', () => {
  beforeEach(() => {
    digitalTwinService.generationJobs.clear();
    delete process.env.HEYGEN_API_KEY;
    delete process.env.SORA_API_KEY;
    delete process.env.SORA_GATEWAY_URL;
    digitalTwinService.heygenApiKey = undefined;
    digitalTwinService.soraApiKey = undefined;
  });

  describe('createAvatarVideo', () => {
    it('returns unavailable/notImplemented when provider is simulated or unconfigured without local fallback', async () => {
      const job = await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        provider: 'simulated'
      });

      expect(job.status).toBe('unavailable');
      expect(job.notImplemented).toBe(true);
      expect(job.message).toContain('HEYGEN_API_KEY');
    });

    it('preserves options on the job object', async () => {
      const job = await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        avatarId: 'custom_avatar_999',
        resolution: '1080p',
        customField: 'testValue'
      });

      expect(job.options).toBeDefined();
      expect(job.options.avatarId).toBe('custom_avatar_999');
      expect(job.options.resolution).toBe('1080p');
      expect(job.options.customField).toBe('testValue');
    });

    it('returns unavailable when HeyGen is requested without an API key', async () => {
      const job = await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        provider: 'heygen'
      });

      expect(job.status).toBe('unavailable');
      expect(job.notImplemented).toBe(true);
      expect(job.message).toContain('HEYGEN_API_KEY');
    });

    it('returns unavailable when Sora is requested without API key or gateway', async () => {
      const job = await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        provider: 'sora'
      });

      expect(job.status).toBe('unavailable');
      expect(job.notImplemented).toBe(true);
      expect(job.message).toContain('Sora');
    });

    it('evicts oldest jobs when registry exceeds limit', async () => {
      // Artificially populate generationJobs
      for (let i = 0; i < 1000; i++) {
        digitalTwinService.generationJobs.set(`JOB-${i}`, { id: `JOB-${i}`, createdAt: i });
      }
      expect(digitalTwinService.generationJobs.size).toBe(1000);

      await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        provider: 'simulated'
      });

      expect(digitalTwinService.generationJobs.size).toBe(1000);
      expect(digitalTwinService.generationJobs.has('JOB-0')).toBe(false);
    });
  });

  describe('getGenerationStatus', () => {
    it('returns null for non-existent jobs', async () => {
      const status = await digitalTwinService.getGenerationStatus('NON_EXISTENT');
      expect(status).toBeNull();
    });

    it('reflects unavailable status for simulated jobs', async () => {
      const job = await digitalTwinService.createAvatarVideo('user123', 'https://example.com/voice.mp3', {
        provider: 'simulated'
      });

      const fetched = await digitalTwinService.getGenerationStatus(job.id);
      expect(fetched.status).toBe('unavailable');
      expect(fetched.notImplemented).toBe(true);
    });

    it('calculates staged progress for processing local_ai jobs', async () => {
      const job = {
        id: 'TWIN-TEST-LOCAL',
        userId: 'user_local_1',
        provider: 'local_ai',
        status: 'processing',
        createdAt: Date.now() - 5000, // 5s ago
      };
      digitalTwinService.generationJobs.set(job.id, job);

      const status = await digitalTwinService.getGenerationStatus('TWIN-TEST-LOCAL');
      expect(status.status).toBe('processing');
      expect(status.progress).toBeGreaterThanOrEqual(20);
      expect(status.stage).toBeDefined();
    });
  });

  describe('getAvailableProviders', () => {
    it('reports provider availability correctly based on credentials', async () => {
      const providers = await digitalTwinService.getAvailableProviders('user123');
      expect(providers).toHaveProperty('heygen');
      expect(providers).toHaveProperty('sora');
      expect(providers).toHaveProperty('localAi');
      expect(providers.localAi.available).toBe(true);
      expect(providers.heygen.available).toBe(false);
      expect(providers.sora.available).toBe(false);

      // Now with simulated HeyGen key
      digitalTwinService.heygenApiKey = 'hg_mock_key';
      const providersWithHeygen = await digitalTwinService.getAvailableProviders('user123');
      expect(providersWithHeygen.heygen.available).toBe(true);
    });
  });

  describe('getUserJobs & deleteJob', () => {
    it('filters jobs by userId and sorts newest first', () => {
      digitalTwinService.generationJobs.set('JOB-1', { id: 'JOB-1', userId: 'userA', createdAt: 1000 });
      digitalTwinService.generationJobs.set('JOB-2', { id: 'JOB-2', userId: 'userB', createdAt: 2000 });
      digitalTwinService.generationJobs.set('JOB-3', { id: 'JOB-3', userId: 'userA', createdAt: 3000 });

      const userAJobs = digitalTwinService.getUserJobs('userA');
      expect(userAJobs.length).toBe(2);
      expect(userAJobs[0].id).toBe('JOB-3');
      expect(userAJobs[1].id).toBe('JOB-1');
    });

    it('allows deleting owned jobs and prevents unauthorized deletion', () => {
      digitalTwinService.generationJobs.set('JOB-DEL', { id: 'JOB-DEL', userId: 'userOwner' });

      expect(() => {
        digitalTwinService.deleteJob('JOB-DEL', 'otherUser');
      }).toThrow('Unauthorized');

      const deleted = digitalTwinService.deleteJob('JOB-DEL', 'userOwner');
      expect(deleted).toBe(true);
      expect(digitalTwinService.generationJobs.has('JOB-DEL')).toBe(false);
    });
  });
});
