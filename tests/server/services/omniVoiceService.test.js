// OmniVoice provider adapter — hermetic tests (global.fetch mocked, no network,
// no filesystem writes beyond a tmp uploads dir cleaned up after).

const fs = require('fs');
const path = require('path');

const svc = require('../../../server/services/omniVoiceService');

const OLD_ENV = { ...process.env };
const realFetch = global.fetch;

function clearOmniEnv() {
  delete process.env.OMNIVOICE_BASE_URL;
  delete process.env.OMNIVOICE_API_KEY;
  delete process.env.OMNIVOICE_MODEL;
  delete process.env.OMNIVOICE_DEFAULT_VOICE;
  delete process.env.OMNIVOICE_TIMEOUT_MS;
}

afterEach(() => {
  global.fetch = realFetch;
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = OLD_ENV;
  global.fetch = realFetch;
});

describe('omniVoiceService.isConfigured', () => {
  beforeEach(clearOmniEnv);

  it('is false when OMNIVOICE_BASE_URL is unset (inert by default)', () => {
    expect(svc.isConfigured()).toBe(false);
  });

  it('is false when OMNIVOICE_BASE_URL is blank/whitespace', () => {
    process.env.OMNIVOICE_BASE_URL = '   ';
    expect(svc.isConfigured()).toBe(false);
  });

  it('is true once a base URL is set', () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    expect(svc.isConfigured()).toBe(true);
  });
});

describe('omniVoiceService.synthesizeSpeech', () => {
  beforeEach(clearOmniEnv);

  it('rejects when not configured', async () => {
    await expect(svc.synthesizeSpeech({ text: 'hi' })).rejects.toThrow(/not configured/i);
  });

  it('POSTs the OpenAI-compatible /audio/speech shape and returns the audio buffer', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    process.env.OMNIVOICE_MODEL = 'cosyvoice';
    const fakeAudio = Buffer.from('ID3-fake-mp3-bytes');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => fakeAudio.buffer.slice(fakeAudio.byteOffset, fakeAudio.byteOffset + fakeAudio.byteLength),
    });

    const out = await svc.synthesizeSpeech({ text: 'Hello world', voice: 'my-profile', speed: 1.5, language: 'ES' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3900/v1/audio/speech');
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      model: 'cosyvoice',
      input: 'Hello world',
      voice: 'my-profile',
      response_format: 'mp3',
      speed: 1.5,
      language: 'es',
    });
    expect(out.buffer.toString()).toBe('ID3-fake-mp3-bytes');
    expect(out.contentType).toBe('audio/mpeg');
  });

  it('appends /v1 when the base URL omits it, and sends the bearer key when set', async () => {
    process.env.OMNIVOICE_BASE_URL = 'https://gpu-box:3900';
    process.env.OMNIVOICE_API_KEY = 'secret-key';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });

    await svc.synthesizeSpeech({ text: 'x' });

    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://gpu-box:3900/v1/audio/speech');
    expect(opts.headers.Authorization).toBe('Bearer secret-key');
  });

  it('omits Authorization for a loopback backend with no key', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });

    await svc.synthesizeSpeech({ text: 'x' });

    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('clamps speed into the engine-supported [0.25, 4.0] range', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });

    await svc.synthesizeSpeech({ text: 'x', speed: 99 });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).speed).toBe(4.0);
  });

  it('throws on a non-2xx backend response', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'engine offline' });
    await expect(svc.synthesizeSpeech({ text: 'x' })).rejects.toThrow(/HTTP 500/);
  });

  it('throws on empty audio (a 200 with no bytes is a failure, not success)', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) });
    await expect(svc.synthesizeSpeech({ text: 'x' })).rejects.toThrow(/empty audio/i);
  });
});

describe('omniVoiceService.generateSpeechFile', () => {
  beforeEach(clearOmniEnv);

  it('writes a crypto-random file under uploads/<subdir> and returns its URL', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('abc').buffer });

    const out = await svc.generateSpeechFile({ text: 'hi', subdir: 'audio' });

    expect(out.url).toMatch(/^\/uploads\/audio\/[a-f0-9]{32}\.mp3$/);
    const abs = path.join(__dirname, '..', '..', '..', 'uploads', 'audio', path.basename(out.url));
    expect(fs.existsSync(abs)).toBe(true);
    fs.unlinkSync(abs); // cleanup
  });
});

describe('omniVoiceService.cloneVoice', () => {
  beforeEach(clearOmniEnv);

  it('rejects when not configured', async () => {
    await expect(svc.cloneVoice(Buffer.from('x'), 'v')).rejects.toThrow(/not configured/i);
  });

  it('rejects with no sample', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    await expect(svc.cloneVoice(null, 'v')).rejects.toThrow(/reference audio/i);
  });

  it('POSTs a Buffer to the native /profiles endpoint (server root, not /v1) and returns the id', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'prof123' }) });

    const id = await svc.cloneVoice(Buffer.from('audio-bytes'), 'My Voice');

    expect(id).toBe('prof123');
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3900/profiles'); // /v1 stripped
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
  });

  it('throws honestly on a non-2xx clone response', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'bad ref' });
    await expect(svc.cloneVoice(Buffer.from('x'), 'v')).rejects.toThrow(/HTTP 422/);
  });
});

describe('omniVoiceService.listVoices', () => {
  beforeEach(clearOmniEnv);

  it('returns [] when not configured (never throws)', async () => {
    await expect(svc.listVoices()).resolves.toEqual([]);
  });

  it('normalizes both bare-array and {voices:[]} response shapes', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ voices: [{ id: 'v1', name: 'Aria', category: 'cloned', preview_url: 'u' }] }),
    });
    const voices = await svc.listVoices();
    expect(voices).toEqual([
      { id: 'v1', name: 'Aria', provider: 'omnivoice', cloned: true, previewUrl: 'u' },
    ]);
  });

  it('returns [] (does not throw) when the backend is unreachable', async () => {
    process.env.OMNIVOICE_BASE_URL = 'http://localhost:3900/v1';
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(svc.listVoices()).resolves.toEqual([]);
  });
});
