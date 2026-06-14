// Unit tests for repurposeService niche-aware copy — the Round 2 upgrade that
// grounds per-platform hooks/hashtags in the marketingKnowledge playbook.
// deterministicCopy is provider-free, so these run with no AI/network.

const svc = require('../../../server/services/repurposeService');
const liveTrendService = require('../../../server/services/liveTrendService');
const aiRouter = require('../../../server/utils/aiRouter');
const personalizationService = require('../../../server/services/personalizationService');

describe('repurposeService.deterministicCopy (niche-aware)', () => {
  it('returns a complete copy object for any platform/niche', () => {
    const c = svc.deterministicCopy('tiktok', 'How I saved $5000', 'finance');
    expect(typeof c.hook).toBe('string');
    expect(c.hook.length).toBeGreaterThan(0);
    expect(typeof c.title).toBe('string');
    expect(typeof c.description).toBe('string');
    expect(Array.isArray(c.hashtags)).toBe(true);
    expect(c.hashtags.length).toBeGreaterThan(0);
    expect(c.hashtags.every((h) => h.startsWith('#'))).toBe(true);
  });

  it('pulls niche-native hashtags from the playbook (finance → #finance + keywords)', () => {
    const c = svc.deterministicCopy('tiktok', 'My budget', 'finance');
    expect(c.hashtags).toContain('#finance');
    // at least one finance keyword tag (e.g. #hysa / #roth / #compoundinterest)
    expect(c.hashtags.some((h) => /hysa|roth|401k|compound|dividend|debt/.test(h))).toBe(true);
  });

  it('respects per-platform hashtag caps (youtube ≤ 3, linkedin ≤ 4, tiktok ≤ 5)', () => {
    expect(svc.deterministicCopy('youtube', 't', 'finance').hashtags.length).toBeLessThanOrEqual(3);
    expect(svc.deterministicCopy('linkedin', 't', 'finance').hashtags.length).toBeLessThanOrEqual(4);
    expect(svc.deterministicCopy('tiktok', 't', 'finance').hashtags.length).toBeLessThanOrEqual(5);
  });

  it('uses platform-appropriate broad tags (tiktok #fyp, linkedin none)', () => {
    expect(svc.deterministicCopy('tiktok', 't', 'health').hashtags).toContain('#fyp');
    expect(svc.deterministicCopy('linkedin', 't', 'health').hashtags).not.toContain('#fyp');
  });

  it('degrades safely for an unknown niche (→ other) and an empty title', () => {
    const unknown = svc.deterministicCopy('tiktok', '', 'totally-made-up-niche');
    expect(unknown.hashtags.length).toBeGreaterThan(0);
    expect(unknown.hook.length).toBeGreaterThan(0);
  });

  it('produces niche-distinct hashtags across niches', () => {
    const fin = svc.deterministicCopy('tiktok', 't', 'finance').hashtags.join(' ');
    const health = svc.deterministicCopy('tiktok', 't', 'health').hashtags.join(' ');
    expect(fin).not.toBe(health);
    expect(fin).toContain('#finance');
    expect(health).toContain('#health');
  });
});

describe('repurposeService live-trend wiring (generatePlatformCopy)', () => {
  let aiSpy;
  beforeEach(() => {
    // Force the deterministic-fallback path so the test is offline + fast; the
    // live-trend enrichment applies to that path too.
    aiSpy = jest.spyOn(aiRouter, 'aiCallJsonValidated').mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('appends the top verified trending hashtag to each platform', async () => {
    jest.spyOn(liveTrendService, 'getLatestTrends').mockResolvedValue({
      source: 'claude+web',
      hashtags: [{ label: '#trendingnow' }, { label: '#second' }],
      topics: [{ label: 'AI agents' }],
    });
    const copy = await svc.generatePlatformCopy({
      baseTitle: 'My budget', platforms: ['tiktok', 'youtube'], tier: 'pro', niche: 'finance',
    });
    expect(copy.tiktok.hashtags).toContain('#trendingnow');
    expect(copy.youtube.hashtags).toContain('#trendingnow');
  });

  it('degrades gracefully when trends are unavailable (no extra tag, copy intact)', async () => {
    jest.spyOn(liveTrendService, 'getLatestTrends').mockResolvedValue({ source: 'unavailable', hashtags: [], topics: [] });
    const copy = await svc.generatePlatformCopy({
      baseTitle: 'My budget', platforms: ['tiktok'], tier: 'pro', niche: 'finance',
    });
    expect(copy.tiktok.hashtags).toContain('#finance'); // static playbook still applies
    expect(copy.tiktok.hashtags).not.toContain('#trendingnow');
  });

  it('never throws when the trend source errors out', async () => {
    jest.spyOn(liveTrendService, 'getLatestTrends').mockRejectedValue(new Error('web search down'));
    const copy = await svc.generatePlatformCopy({
      baseTitle: 'My budget', platforms: ['tiktok'], tier: 'pro', niche: 'finance',
    });
    expect(Array.isArray(copy.tiktok.hashtags)).toBe(true);
    expect(copy.tiktok.hashtags.length).toBeGreaterThan(0);
  });
});

describe('repurposeService personalization wiring (generatePlatformCopy)', () => {
  beforeEach(() => {
    jest.spyOn(liveTrendService, 'getLatestTrends').mockResolvedValue({ source: 'unavailable', hashtags: [], topics: [] });
  });
  afterEach(() => jest.restoreAllMocks());

  it('passes the personalized systemPrompt to the AI call when a userId is present', async () => {
    jest.spyOn(personalizationService, 'buildPersonalizedSystemPrompt').mockResolvedValue('SYS-PERSONALIZED');
    const aiSpy = jest.spyOn(aiRouter, 'aiCallJsonValidated').mockResolvedValue(null);
    await svc.generatePlatformCopy({ baseTitle: 'x', platforms: ['tiktok'], tier: 'pro', niche: 'finance', userId: 'u1' });
    expect(aiSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ systemPrompt: 'SYS-PERSONALIZED' }));
  });

  it('maps a per-request creativity knob to sampling temperature', async () => {
    jest.spyOn(personalizationService, 'buildPersonalizedSystemPrompt').mockResolvedValue('SYS');
    const aiSpy = jest.spyOn(aiRouter, 'aiCallJsonValidated').mockResolvedValue(null);
    await svc.generatePlatformCopy({ baseTitle: 'x', platforms: ['tiktok'], tier: 'pro', niche: 'finance', userId: 'u1', personalization: { creativity: 0.2 } });
    // 0.2 clamps up to the 0.4 floor
    expect(aiSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ temperature: 0.4 }));
  });
});

describe('repurposeService.planRepurpose (niche threading + tier clamp)', () => {
  it('clamps to the tier and attaches niche-aware copy', async () => {
    const plan = await svc.planRepurpose({
      baseTree: { metadata: { title: 'Test' } },
      targets: ['9:16', '1:1', '16:9', '4:5'],
      tier: 'free',
      niche: 'finance',
    });
    expect(plan.variants.length).toBe(1);          // free → 1 variant
    expect(plan.clampedFrom).toBe(4);
    const v = plan.variants[0];
    expect(Array.isArray(v.hashtags)).toBe(true);
    expect(v.hashtags.length).toBeGreaterThan(0);
  }, 20000);
});
