// Foley service — guards the route↔service contract that POST /api/dubbing/foley/*
// depends on. routes/dubbing.js imports analyzeTimelineTransitions +
// generateFoleyAudio; before this fix the service didn't export them, so both
// foley routes 500'd at call time (lint/tsc don't catch a missing export).

const svc = require('../../../server/services/aiFoleyService');

describe('aiFoleyService exports (route contract)', () => {
  it('exports the functions routes/dubbing.js imports', () => {
    // These four names are the public contract; the two new ones are what the
    // foley routes destructure. Keep them exported.
    expect(typeof svc.generateFoley).toBe('function');
    expect(typeof svc.alignFoleyToTimeline).toBe('function');
    expect(typeof svc.analyzeTimelineTransitions).toBe('function');
    expect(typeof svc.generateFoleyAudio).toBe('function');
  });
});

describe('analyzeTimelineTransitions', () => {
  it('returns [] for empty / single-clip timelines (no cuts)', () => {
    expect(svc.analyzeTimelineTransitions([], [])).toEqual([]);
    expect(svc.analyzeTimelineTransitions([{ startTime: 0, duration: 5 }], [])).toEqual([]);
    expect(svc.analyzeTimelineTransitions(null, null)).toEqual([]);
  });

  it('emits one event per cut (between clips) with a prompt', () => {
    const segments = [
      { startTime: 0, duration: 4, type: 'clip' },
      { startTime: 4, duration: 2, type: 'clip' },
      { startTime: 6, duration: 1, type: 'clip' },
    ];
    const events = svc.analyzeTimelineTransitions(segments, []);
    expect(events).toHaveLength(2); // cuts at clip 1 and clip 2
    expect(events[0]).toMatchObject({ index: 1, startTime: 4, transitionType: 'cut' });
    expect(typeof events[0].prompt).toBe('string');
    expect(events[0].prompt.length).toBeGreaterThan(0);
  });

  it('matches an effect at the cut to set its transition type', () => {
    const segments = [
      { startTime: 0, duration: 3 },
      { startTime: 3, duration: 3 },
    ];
    const events = svc.analyzeTimelineTransitions(segments, [{ type: 'zoom_in', startTime: 3 }]);
    expect(events[0].transitionType).toBe('zoom_in');
  });

  it('clamps duration into the SFX-supportable [0.1, 6] range', () => {
    const events = svc.analyzeTimelineTransitions(
      [{ startTime: 0, duration: 3 }, { startTime: 3, duration: 999 }],
      []
    );
    expect(events[0].durationSeconds).toBe(6);
  });
});

describe('generateFoleyAudio', () => {
  const OLD_KEY = process.env.ELEVENLABS_API_KEY;
  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env.ELEVENLABS_API_KEY;
    else process.env.ELEVENLABS_API_KEY = OLD_KEY;
  });

  it('returns [] for no events (never throws)', async () => {
    await expect(svc.generateFoleyAudio([], 'vid')).resolves.toEqual([]);
    await expect(svc.generateFoleyAudio(null)).resolves.toEqual([]);
  });

  it('returns [] honestly (no crash, no fake success) when no SFX provider is configured', async () => {
    delete process.env.ELEVENLABS_API_KEY; // generateFoley() returns null → dropped
    const events = [{ index: 1, startTime: 4, durationSeconds: 1, transitionType: 'cut' }];
    await expect(svc.generateFoleyAudio(events, 'vid')).resolves.toEqual([]);
  });
});
