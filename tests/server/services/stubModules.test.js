// The 3 previously-BLANK service modules now export their consumers' function
// surface returning honest empty results (non-blank, non-crashing). This pins
// that contract so they can't silently revert to blank (which reintroduced the
// "X is not a function" breakage for anything that forgot to guard).

describe('sceneDetectionService (honest stub)', () => {
  const s = require('../../../server/services/sceneDetectionService');
  it('exports the consumer surface', () => {
    ['detectScenes', 'getScenesForAsset', 'getVideoFilePath'].forEach((f) => expect(typeof s[f]).toBe('function'));
  });
  it('returns safe empties', async () => {
    expect(await s.detectScenes('v1')).toEqual({ scenes: [] });
    expect(await s.getScenesForAsset('c1')).toEqual({ scenes: [] });
    expect(await s.getVideoFilePath('c1')).toBeNull();
  });
});

describe('visualAudioFusion (honest stub)', () => {
  const v = require('../../../server/services/visualAudioFusion');
  it('exports the consumer surface', () => {
    ['fuseVisualAudioBoundaries', 'refineSceneBoundariesWithAudio', 'compareShotAudioFeatures'].forEach((f) => expect(typeof v[f]).toBe('function'));
  });
  it('fuse returns empty decisions (downstream maps yield nothing)', () => {
    expect(v.fuseVisualAudioBoundaries([], []).decisions).toEqual([]);
  });
  it('refine passes visual boundaries through', () => {
    const b = [{ timestamp: 1 }];
    expect(v.refineSceneBoundariesWithAudio(b, [])).toBe(b);
  });
  it('compare returns a neutral comparison', () => {
    expect(v.compareShotAudioFeatures(0, 1, [], 1)).toEqual({ distance: 0, classChange: false, classChangeMagnitude: 0 });
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
