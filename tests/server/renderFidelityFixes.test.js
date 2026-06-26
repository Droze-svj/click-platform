// Render-fidelity gap closures: fields that rendered in the live PREVIEW but were
// dropped or wrong in the EXPORT now render correctly, and a signed /uploads URL
// resolves to the real file on disk (so local-storage music/overlays actually play).

const { buildVideoFilterChain } = require('../../server/services/videoRenderService');
const { toAbsolutePath } = require('../../server/utils/pathUtils');
const { buildReverbFilter } = require('../../server/services/audioEffectsService');

describe('render fidelity fixes', () => {
  it('vignette intensity scales (noir darker than cinematic — was a fixed angle)', () => {
    const weak = buildVideoFilterChain({ vignette: 28 }).find((p) => p.startsWith('vignette'));
    const strong = buildVideoFilterChain({ vignette: 55 }).find((p) => p.startsWith('vignette'));
    expect(weak).toMatch(/vignette=angle=/);
    expect(strong).toMatch(/vignette=angle=/);
    expect(weak).not.toEqual(strong);
    const ang = (s) => Number(s.split('=').pop());
    expect(ang(strong)).toBeGreaterThan(ang(weak)); // larger angle = stronger
  });

  it('sepia is a real warm matrix with cross terms (not a uniform darken)', () => {
    const sep = buildVideoFilterChain({ sepia: 35 }).find((p) => p.startsWith('colorchannelmixer'));
    expect(sep).toMatch(/rg=/); // cross term → hue shift (warmth), not rr=gg=bb only
    expect(sep).toMatch(/gr=/);
  });

  it('shadows render via curves and clarity via unsharp (were preview-only)', () => {
    expect(buildVideoFilterChain({ shadows: 25 }).some((p) => p.startsWith('curves='))).toBe(true);
    expect(buildVideoFilterChain({ clarity: 112 }).some((p) => p.startsWith('unsharp='))).toBe(true);
  });

  it('brightness is clamped into ffmpeg’s valid [-1,1] eq range', () => {
    expect(buildVideoFilterChain({ brightness: 300 })[0]).toBe('eq=brightness=1');
    expect(buildVideoFilterChain({ brightness: 0 })[0]).toBe('eq=brightness=-1');
  });

  it('toAbsolutePath strips a signed ?exp=&sig= suffix so local media resolves', () => {
    expect(toAbsolutePath('/uploads/music/x.mp3?exp=123&sig=abc')).toBe('/uploads/music/x.mp3');
    expect(toAbsolutePath('/uploads/music/x.mp3')).toBe('/uploads/music/x.mp3'); // unchanged when clean
  });

  it('reverb stays valid at the slider extremes (no aecho=…:0)', () => {
    expect(buildReverbFilter({ roomSize: 0, damping: 1 })).toMatch(/aecho=0\.8:0\.88:[1-9]/);
    expect(buildReverbFilter({ roomSize: 0, damping: 1 })).not.toMatch(/:0$/);
  });
});
