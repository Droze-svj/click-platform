// Unit tests for imageGenerationService — request handling, response parsing,
// and HONEST graceful degradation. The HTTP layer is mocked (no network/credits).

const img = require('../../../server/services/imageGenerationService');

const okResp = (data) => ({ ok: true, status: 200, json: async () => data });

describe('imageGenerationService.extractUrl', () => {
  it('handles string, array and object output shapes', () => {
    expect(img.extractUrl('https://x/a.png')).toBe('https://x/a.png');
    expect(img.extractUrl(['https://x/a.png', 'b'])).toBe('https://x/a.png');
    expect(img.extractUrl({ url: 'https://x/c.png' })).toBe('https://x/c.png');
    expect(img.extractUrl(null)).toBeNull();
    expect(img.extractUrl([])).toBeNull();
  });
});

describe('imageGenerationService.generateImage', () => {
  const realKey = process.env.REPLICATE_API_KEY;
  afterEach(() => {
    if (realKey === undefined) delete process.env.REPLICATE_API_KEY;
    else process.env.REPLICATE_API_KEY = realKey;
    jest.restoreAllMocks();
  });

  it('rejects an empty prompt', async () => {
    const r = await img.generateImage('   ');
    expect(r.ok).toBe(false);
    expect(r.unavailable).toBeFalsy();
  });

  it('returns unavailable (not a throw) when REPLICATE_API_KEY is absent', async () => {
    delete process.env.REPLICATE_API_KEY;
    const r = await img.generateImage('a neon city at night');
    expect(r).toMatchObject({ ok: false, unavailable: true });
  });

  it('returns the image URL on a succeeded prediction', async () => {
    process.env.REPLICATE_API_KEY = 'test-key';
    const fetchImpl = jest.fn().mockResolvedValue(okResp({ status: 'succeeded', output: ['https://img/out.png'] }));
    const r = await img.generateImage('a neon city', { fetchImpl, aspectRatio: '9:16' });
    expect(r).toMatchObject({ ok: true, url: 'https://img/out.png' });
    // sends a POST to the model predictions endpoint with the prompt
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/models/');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).input.prompt).toBe('a neon city');
    expect(init.headers.Authorization).toContain('test-key');
  });

  it('polls while processing, then resolves', async () => {
    process.env.REPLICATE_API_KEY = 'test-key';
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(okResp({ status: 'processing', urls: { get: 'https://api/poll/1' } }))
      .mockResolvedValueOnce(okResp({ status: 'succeeded', output: 'https://img/poll.png' }));
    const r = await img.generateImage('cat', { fetchImpl, pollMs: 1 });
    expect(r).toMatchObject({ ok: true, url: 'https://img/poll.png' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns an error (not unavailable) on a failed prediction', async () => {
    process.env.REPLICATE_API_KEY = 'test-key';
    const fetchImpl = jest.fn().mockResolvedValue(okResp({ status: 'failed', error: 'nsfw' }));
    const r = await img.generateImage('cat', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.unavailable).toBeFalsy();
  });

  it('degrades gracefully when the HTTP layer throws', async () => {
    process.env.REPLICATE_API_KEY = 'test-key';
    const fetchImpl = jest.fn().mockRejectedValue(new Error('network down'));
    const r = await img.generateImage('cat', { fetchImpl });
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
  });
});
