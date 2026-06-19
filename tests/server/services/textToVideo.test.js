const {
  isTTVConfigured, buildProviderRequest, parseProviderResponse, generateBRollVideo, getBRollStatus,
} = require('../../../server/services/textToVideoService');

const REPLICATE = { provider: 'replicate', key: 'r8_test', model: 'owner/model:abc123' };

describe('isTTVConfigured (pure)', () => {
  it('requires provider + key + model for replicate', () => {
    expect(isTTVConfigured({ provider: 'replicate', key: null, model: null })).toBe(false);
    expect(isTTVConfigured({ provider: 'replicate', key: 'k', model: null })).toBe(false);
    expect(isTTVConfigured(REPLICATE)).toBe(true);
  });
  it('treats unknown providers as unconfigured', () => {
    expect(isTTVConfigured({ provider: 'runway', key: 'k', model: 'm' })).toBe(false);
    expect(isTTVConfigured({ provider: '', key: null, model: null })).toBe(false);
  });
});

describe('buildProviderRequest (pure)', () => {
  it('builds a replicate predictions POST with auth + frame count', () => {
    const req = buildProviderRequest(REPLICATE, 'a neon city', { duration: 5 });
    expect(req.url).toBe('https://api.replicate.com/v1/predictions');
    expect(req.method).toBe('POST');
    expect(req.headers.Authorization).toBe('Token r8_test');
    expect(req.body.version).toBe('owner/model:abc123');
    expect(req.body.input.num_frames).toBe(120); // 5s * 24fps
  });
  it('returns null for an unsupported provider', () => {
    expect(buildProviderRequest({ provider: 'pika' }, 'x')).toBeNull();
  });
});

describe('parseProviderResponse (pure)', () => {
  it('maps succeeded → ready with the output url', () => {
    const r = parseProviderResponse(REPLICATE, { id: 'p1', status: 'succeeded', output: ['https://cdn/x.mp4'] });
    expect(r).toMatchObject({ status: 'ready', url: 'https://cdn/x.mp4', jobId: 'p1' });
  });
  it('maps processing → processing with a jobId (no url)', () => {
    const r = parseProviderResponse(REPLICATE, { id: 'p2', status: 'processing' });
    expect(r).toMatchObject({ status: 'processing', url: null, jobId: 'p2' });
  });
  it('maps failed → error, and succeeded-without-output → error (never a fake url)', () => {
    expect(parseProviderResponse(REPLICATE, { id: 'p3', status: 'failed', error: 'boom' }).status).toBe('error');
    const noOut = parseProviderResponse(REPLICATE, { id: 'p4', status: 'succeeded', output: null });
    expect(noOut.status).toBe('error');
    expect(noOut.url).toBeNull();
  });
});

describe('generateBRollVideo (orchestrator, honest fallback)', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('returns unavailable (no fabricated url) when no provider configured', async () => {
    delete process.env.TTV_PROVIDER;
    const r = await generateBRollVideo('sunset over the ocean');
    expect(r.status).toBe('unavailable');
    expect(r.url).toBeNull();
    expect(r.refinedPrompt).toBeTruthy();
  });

  it('calls the provider and returns the real url when configured', async () => {
    process.env.TTV_PROVIDER = 'replicate';
    process.env.REPLICATE_API_TOKEN = 'r8_test';
    process.env.TTV_MODEL_VERSION = 'owner/model:abc123';
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({ id: 'p9', status: 'succeeded', output: ['https://cdn/clip.mp4'] }),
    });
    const r = await generateBRollVideo('a calm forest', { duration: 3, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('ready');
    expect(r.url).toBe('https://cdn/clip.mp4');
  });

  it('polls a processing job until it succeeds (real url, never fabricated)', async () => {
    process.env.TTV_PROVIDER = 'replicate';
    process.env.REPLICATE_API_TOKEN = 'r8_test';
    process.env.TTV_MODEL_VERSION = 'owner/model:abc123';
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ id: 'p1', status: 'processing', urls: { get: 'https://api/p1' } }) })
      .mockResolvedValueOnce({ json: async () => ({ id: 'p1', status: 'succeeded', output: ['https://cdn/final.mp4'] }) });
    const r = await generateBRollVideo('a city at night', { fetchImpl, pollMs: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(r.status).toBe('ready');
    expect(r.url).toBe('https://cdn/final.mp4');
  });

  it('returns processing + jobId (no url) when the budget elapses', async () => {
    process.env.TTV_PROVIDER = 'replicate';
    process.env.REPLICATE_API_TOKEN = 'r8_test';
    process.env.TTV_MODEL_VERSION = 'owner/model:abc123';
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({ id: 'pX', status: 'processing', urls: { get: 'https://api/pX' } }),
    });
    const r = await generateBRollVideo('slow render', { fetchImpl, pollMs: 1, timeoutMs: -1 });
    expect(r.status).toBe('processing');
    expect(r.jobId).toBe('pX');
    expect(r.url).toBeNull();
  });
});

describe('getBRollStatus', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('is unavailable when not configured', async () => {
    delete process.env.TTV_PROVIDER;
    const r = await getBRollStatus('job1');
    expect(r.status).toBe('unavailable');
    expect(r.url).toBeNull();
  });

  it('returns the ready url for a finished job', async () => {
    process.env.TTV_PROVIDER = 'replicate';
    process.env.REPLICATE_API_TOKEN = 'r8_test';
    process.env.TTV_MODEL_VERSION = 'owner/model:abc123';
    const fetchImpl = jest.fn().mockResolvedValue({
      json: async () => ({ id: 'job1', status: 'succeeded', output: ['https://cdn/done.mp4'] }),
    });
    const r = await getBRollStatus('job1', { fetchImpl });
    expect(r.status).toBe('ready');
    expect(r.url).toBe('https://cdn/done.mp4');
  });

  it('requires a jobId', async () => {
    expect((await getBRollStatus('')).status).toBe('error');
  });
});
