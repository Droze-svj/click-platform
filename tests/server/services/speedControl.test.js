const { buildAtempoChain, getSpeedPresets } = require('../../../server/services/speedControlService');

describe('buildAtempoChain (ffmpeg atempo 0.5–2.0 limit)', () => {
  it('chains fast speeds into valid 0.5–2.0 factors', () => {
    expect(buildAtempoChain(4)).toEqual(['atempo=2.0', 'atempo=2.0000']);
    expect(buildAtempoChain(8)).toEqual(['atempo=2.0', 'atempo=2.0', 'atempo=2.0000']);
    expect(buildAtempoChain(3)).toEqual(['atempo=2.0', 'atempo=1.5000']);
  });

  it('chains slow speeds too', () => {
    expect(buildAtempoChain(0.25)).toEqual(['atempo=0.5', 'atempo=0.5000']);
  });

  it('every emitted factor is within ffmpeg\'s [0.5, 2.0]', () => {
    for (const s of [0.1, 0.25, 0.5, 1.5, 2, 3, 4, 8, 16]) {
      for (const f of buildAtempoChain(s)) {
        const v = Number(f.split('=')[1]);
        expect(v).toBeGreaterThanOrEqual(0.5);
        expect(v).toBeLessThanOrEqual(2.0);
      }
    }
  });

  it('returns [] for speed 1 / invalid', () => {
    expect(buildAtempoChain(1)).toEqual([]);
    expect(buildAtempoChain(0)).toEqual([]);
    expect(buildAtempoChain('x')).toEqual([]);
  });

  it('the documented 4x/8x presets no longer produce an out-of-range atempo', () => {
    const presets = getSpeedPresets();
    for (const key of Object.keys(presets)) {
      const chain = buildAtempoChain(presets[key].speed);
      for (const f of chain) {
        const v = Number(f.split('=')[1]);
        expect(v).toBeGreaterThanOrEqual(0.5);
        expect(v).toBeLessThanOrEqual(2.0);
      }
    }
  });
});
