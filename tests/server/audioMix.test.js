// Pro audio suite (Wave 2A): the render audio chain is parameterized by an AudioMix
// (music volume / ducking / fades / voice preset / EQ-comp-reverb). These lock in:
// neutral when absent (backward-compatible render), clamping, and — critically —
// that request data can NEVER inject into the ffmpeg filter graph.

const { buildAudioMix, buildMasterFx } = require('../../server/services/videoRenderService');

describe('buildAudioMix', () => {
  it('is fully neutral when no audio is provided (render stays byte-identical)', () => {
    const m = buildAudioMix(null, { duration: 30 });
    expect(m).toEqual({ musicVolume: null, duckLevel: null, musicFade: '', voice: null, masterFx: '', preset: null });
  });

  it('resolves volume / ducking / fades and a voice preset', () => {
    const m = buildAudioMix({ musicVolume: 0.8, duckingAmount: -18, fadeInSec: 1.5, fadeOutSec: 2, audioPreset: 'voice-boost' }, { duration: 30 });
    expect(m.musicVolume).toBe(0.8);
    expect(m.duckLevel).toBe(-18);
    expect(m.musicFade).toContain('afade=t=in:d=1.5');
    expect(m.musicFade).toContain('afade=t=out:st=28.00:d=2'); // 30 - 2
    expect(m.voice).toContain('acompressor');                  // voice-boost adds compression
  });

  it('clamps out-of-range numerics', () => {
    const m = buildAudioMix({ musicVolume: 99, duckingAmount: -999, fadeInSec: 100 }, { duration: 30 });
    expect(m.musicVolume).toBe(2);     // clamped to [0,2]
    expect(m.duckLevel).toBe(-40);     // clamped to [-40,0]
    expect(m.musicFade).toContain('d=10'); // fade clamped to [0,10]
  });

  it('an unknown audioPreset falls back to the default voice chain (null)', () => {
    expect(buildAudioMix({ audioPreset: 'bogus' }, {}).voice).toBeNull();
  });

  it('builds the EQ/compression/reverb master chain from clean configs', () => {
    const fx = buildMasterFx({
      eq: { bands: [{ frequency: 3000, gain: 4, q: 1.2 }] },
      compression: { threshold: -20, ratio: 3 },
      reverb: { roomSize: 0.4 },
    });
    expect(fx).toContain('equalizer=f=3000');
    expect(fx).toContain('acompressor=threshold=-20dB');
    expect(fx).toContain('aecho=');
  });

  it('SANITIZES malicious config — no raw string can reach the filter graph', () => {
    const fx = buildMasterFx({ eq: { bands: [{ frequency: '3000; rm -rf /', gain: 'evil', q: 99 }] } });
    expect(fx).not.toMatch(/rm -rf/);
    expect(fx).not.toMatch(/evil/);
    expect(fx).toBe('equalizer=f=1000:width_type=o:width=10:g=0'); // frequency→default, gain→0, q→clamped 10
  });
});
