// Unit tests for the unified generationService façade — the honest
// {ok,asset,unavailable,error} contract and capability reporting. No keys set,
// so every provider must report "unavailable" rather than throw.

const gen = require('../../../server/services/generationService');
const personalizationService = require('../../../server/services/personalizationService');
const imageGen = require('../../../server/services/imageGenerationService');

describe('generationService personalization + learning hook', () => {
  afterEach(() => jest.restoreAllMocks());

  it('injects the brand grade into the image prompt AND records it as a learning signal', async () => {
    jest.spyOn(personalizationService, 'getPersona').mockResolvedValue({ brand: { colors: { primary: '#FF0050' }, colorGrade: 'cinematic' }, voice: {} });
    const imgSpy = jest.spyOn(imageGen, 'generateImage').mockResolvedValue({ ok: true, url: 'https://img/x.png' });
    const rec = jest.spyOn(personalizationService, 'recordChoices').mockResolvedValue({ recorded: 2 });

    const r = await gen.generate('image', { userId: 'u1', prompt: 'a city skyline' });
    expect(r.ok).toBe(true);
    // brand palette + grade folded into the provider prompt
    expect(imgSpy.mock.calls[0][0]).toMatch(/#FF0050/);
    expect(imgSpy.mock.calls[0][0]).toMatch(/cinematic color grade/);
    // colour grade recorded back into the learned profile
    expect(rec).toHaveBeenCalledWith('u1', expect.arrayContaining([
      expect.objectContaining({ facet: 'colorGrades', key: 'cinematic' }),
      expect.objectContaining({ weightedFacet: 'weightedColorGrades', key: 'cinematic' }),
    ]));
  });

  it('does not record when no brand grade is set', async () => {
    jest.spyOn(personalizationService, 'getPersona').mockResolvedValue({ brand: { colors: {}, colorGrade: '' }, voice: {} });
    jest.spyOn(imageGen, 'generateImage').mockResolvedValue({ ok: true, url: 'https://img/y.png' });
    const rec = jest.spyOn(personalizationService, 'recordChoices').mockResolvedValue({ recorded: 0 });
    await gen.generate('image', { userId: 'u1', prompt: 'a city' });
    expect(rec).not.toHaveBeenCalled();
  });
});

describe('generationService.getCapabilities', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'REPLICATE_API_KEY']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('reports all live generators false with no keys, and a music pointer', () => {
    const c = gen.getCapabilities();
    expect(c.voiceover).toBe(false);
    expect(c.sfx).toBe(false);
    expect(c.image).toBe(false);
    expect(c.music).toMatchObject({ available: false, endpoint: '/api/ai-music/generate' });
    expect(Array.isArray(c.sfxStyles)).toBe(true);
  });

  it('flips voiceover/sfx true when ELEVENLABS_API_KEY is present', () => {
    process.env.ELEVENLABS_API_KEY = 'x';
    const c = gen.getCapabilities();
    expect(c.voiceover).toBe(true);
    expect(c.sfx).toBe(true);
  });
});

describe('generationService.generate (graceful, no providers configured)', () => {
  const saved = {};
  beforeEach(() => {
    for (const k of ['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'REPLICATE_API_KEY']) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('image → unavailable without a key', async () => {
    const r = await gen.generate('image', { prompt: 'a cat' });
    expect(r).toMatchObject({ ok: false, unavailable: true });
  });

  it('voiceover → unavailable without a key', async () => {
    const r = await gen.generate('voiceover', { text: 'hello' });
    expect(r).toMatchObject({ ok: false, unavailable: true });
  });

  it('sfx → unavailable without a key', async () => {
    const r = await gen.generate('sfx', { style: 'whoosh' });
    expect(r).toMatchObject({ ok: false, unavailable: true });
  });

  it('voiceover with empty text → validation error (not unavailable)', async () => {
    const r = await gen.generate('voiceover', { text: '   ' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/text/i);
  });

  it('unknown kind → error', async () => {
    const r = await gen.generate('hologram', {});
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/unknown/i);
  });
});
