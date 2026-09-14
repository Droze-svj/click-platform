// These modules were once committed BLANK (0 bytes), then as honest empty stubs.
// sceneDetectionService and visualAudioFusion are now REAL (wired to the ffmpeg
// detector and doing actual audio comparison respectively); this file pins both
// the exported surface — so they can't revert to blank and reintroduce the
// "X is not a function" breakage — and the degradation behavior, which still
// matters because detection needs a real ffmpeg binary and a readable file.

describe('sceneDetectionService', () => {
  const s = require('../../../server/services/sceneDetectionService');
  it('exports the consumer surface', () => {
    ['detectScenes', 'getScenesForAsset', 'getVideoFilePath'].forEach((f) => expect(typeof s[f]).toBe('function'));
  });
  it('degrades to no scenes (never throws) when the path is missing or unreadable', async () => {
    expect(await s.detectScenes('')).toEqual({ scenes: [] });
    // A path outside uploads/ is rejected by toAbsolutePath, then fails to open.
    const res = await s.detectScenes('/definitely/not/a/video.mp4');
    expect(Array.isArray(res.scenes)).toBe(true);
    expect(res.scenes).toEqual([]);
  });
  it('returns null for an unresolvable asset path', async () => {
    expect(await s.getVideoFilePath('')).toBeNull();
  });
});

describe('visualAudioFusion', () => {
  const v = require('../../../server/services/visualAudioFusion');

  // One window per second: the first half is loud speech, the second half is
  // quiet music with a very different spectrum — i.e. a real scene change at 3s.
  const audioFeatures = {
    windows: [0, 1, 2, 3, 4, 5].map((t) => {
      const before = t < 3;
      return {
        start: t,
        end: t + 1,
        energy: { energy: before ? 0.9 : 0.1 },
        spectral: {
          centroid: before ? 3000 : 400,
          bandwidth: before ? 2500 : 300,
          rolloff: before ? 7000 : 900,
          zeroCrossingRate: before ? 0.4 : 0.05,
          spectralFlux: before ? 0.8 : 0.1,
          mfccs: new Array(8).fill(before ? 40 : -40),
        },
        classification: before ? { voice: 0.9, music: 0.05, silence: 0.05 } : { voice: 0.05, music: 0.9, silence: 0.05 },
        speakerChange: { hasChange: false },
      };
    }),
  };

  it('exports the consumer surface', () => {
    ['fuseVisualAudioBoundaries', 'refineSceneBoundariesWithAudio', 'compareShotAudioFeatures'].forEach((f) => expect(typeof v[f]).toBe('function'));
  });

  it('measures a large audio distance across a real change, and ~none within a steady passage', () => {
    const across = v.compareShotAudioFeatures(3, 3, audioFeatures, 1.5);
    expect(across.hasAudio).toBe(true);
    expect(across.distance).toBeGreaterThan(0.3);
    expect(across.classChange).toBe(true);
    expect(across.classChangeMagnitude).toBeGreaterThan(0.5);

    const within = v.compareShotAudioFeatures(1, 1, audioFeatures, 1);
    expect(within.distance).toBeLessThan(0.05);
    expect(within.classChange).toBe(false);
  });

  it('reports no-audio honestly rather than a fabricated distance of 0', () => {
    const res = v.compareShotAudioFeatures(0, 1, { windows: [] }, 1);
    expect(res).toMatchObject({ distance: 0, classChange: false, hasAudio: false });
  });

  it('promotes the audio-corroborated cut to a scene boundary and demotes the quiet one', () => {
    // Two visual cuts of identical visual strength, below the visual threshold:
    // only the one the audio agrees with should become a scene boundary.
    const visualBoundaries = [{ timestamp: 1, confidence: 0.2 }, { timestamp: 3, confidence: 0.2 }];
    const { decisions, sceneBoundaries, shotCuts } = v.fuseVisualAudioBoundaries(
      visualBoundaries, audioFeatures, { visualThreshold: 0.5, audioThreshold: 0.3 }
    );

    expect(decisions).toHaveLength(2);
    expect(decisions[0].isSceneBoundary).toBe(false);
    expect(decisions[1].isSceneBoundary).toBe(true);
    expect(decisions[1].reason).toBe('audio_only');
    expect(sceneBoundaries.map((b) => b.timestamp)).toEqual([3]);
    expect(shotCuts.map((b) => b.timestamp)).toEqual([1]);
    expect(decisions[1].confidence).toBeGreaterThan(decisions[0].confidence);
  });

  it('requireBoth demands visual AND audio agreement', () => {
    const visualBoundaries = [{ timestamp: 3, confidence: 0.2 }];
    const { decisions } = v.fuseVisualAudioBoundaries(
      visualBoundaries, audioFeatures, { requireBoth: true, visualThreshold: 0.5 }
    );
    expect(decisions[0].isSceneBoundary).toBe(false);
    expect(decisions[0].reason).toBe('visual_below_threshold');
  });

  it('falls back to the visual signal when there is no audio at all', () => {
    const { decisions } = v.fuseVisualAudioBoundaries(
      [{ timestamp: 1, confidence: 0.9 }, { timestamp: 2, confidence: 0.1 }], { windows: [] }, {}
    );
    expect(decisions[0].isSceneBoundary).toBe(true);
    expect(decisions[0].reason).toBe('visual_only');
    expect(decisions[1].isSceneBoundary).toBe(false);
  });

  it('handles empty input without throwing', () => {
    expect(v.fuseVisualAudioBoundaries([], []).decisions).toEqual([]);
  });

  it('refine passes boundaries through unchanged when there is no audio to judge with', () => {
    const b = [{ timestamp: 1 }];
    expect(v.refineSceneBoundariesWithAudio(b, [])).toBe(b);
  });

  it('refine drops a weak boundary the audio contradicts, keeps the corroborated one', () => {
    const kept = v.refineSceneBoundariesWithAudio(
      [{ timestamp: 1, confidence: 0.2 }, { timestamp: 3, confidence: 0.2 }], audioFeatures, {}
    );
    expect(kept.map((b) => b.timestamp)).toEqual([3]);
  });
});

describe('musicLicensingProviderService (honest stub)', () => {
  const m = require('../../../server/services/musicLicensingProviderService');
  it('exports the consumer surface', () => {
    ['searchTracksAcrossProviders', 'getProvider', 'storeLicensedTrack'].forEach((f) => expect(typeof m[f]).toBe('function'));
  });
  it('returns safe empties', async () => {
    expect(await m.searchTracksAcrossProviders('q')).toEqual([]);
    expect(m.getProvider('x')).toBeNull();
    expect(await m.storeLicensedTrack({})).toBeNull();
  });
});
