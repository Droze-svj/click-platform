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

  it('toAbsolutePath strips a signed ?exp=&sig= suffix AND resolves /uploads project-relative', () => {
    // A "/uploads/..." URL is project-relative (media lives under <root>/uploads),
    // NOT an OS-root path. It must resolve onto process.cwd() — returning the bare
    // "/uploads/..." (as the old code did) meant local music/SFX never resolved on
    // export.
    const path = require('path');
    const expected = path.join(process.cwd(), 'uploads/music/x.mp3');
    expect(toAbsolutePath('/uploads/music/x.mp3?exp=123&sig=abc')).toBe(expected); // query stripped + resolved
    expect(toAbsolutePath('/uploads/music/x.mp3')).toBe(expected); // resolved even when clean
  });

  it('reverb stays valid at the slider extremes (no aecho=…:0)', () => {
    expect(buildReverbFilter({ roomSize: 0, damping: 1 })).toMatch(/aecho=0\.8:0\.88:[1-9]/);
    expect(buildReverbFilter({ roomSize: 0, damping: 1 })).not.toMatch(/:0$/);
  });
});

describe('B-roll overlay compositing (export parity with the preview cover)', () => {
  const { isBrollOverlaySeg, selectPrimarySegments, buildBrollOverlaySegment } = require('../../server/services/videoRenderService');

  it('classifies B-roll = type broll OR B-Roll tracks 2/3 with a source (not audio/A-roll)', () => {
    expect(isBrollOverlaySeg({ type: 'broll', sourceUrl: '/uploads/videos/b.mp4' })).toBe(true);
    expect(isBrollOverlaySeg({ type: 'video', track: 2, sourceUrl: '/uploads/videos/b.mp4' })).toBe(true);
    expect(isBrollOverlaySeg({ type: 'video', track: 3, sourceUrl: '/uploads/videos/b.mp4' })).toBe(true);
    // A-roll (main) tracks 0/1 are NOT B-roll:
    expect(isBrollOverlaySeg({ type: 'video', track: 0, sourceUrl: '/uploads/videos/a.mp4' })).toBe(false);
    expect(isBrollOverlaySeg({ type: 'video', track: 1, sourceUrl: '/uploads/videos/a.mp4' })).toBe(false);
    // No source, or audio → not a B-roll overlay:
    expect(isBrollOverlaySeg({ type: 'broll' })).toBe(false);
    expect(isBrollOverlaySeg({ type: 'audio', track: 2, sourceUrl: '/uploads/audio/x.mp3' })).toBe(false);
  });

  it('excludes B-roll from the primary stitch sequence (it composites as an overlay instead)', () => {
    const segs = [
      { id: 'main', type: 'video', track: 0, startTime: 0, endTime: 5 },
      { id: 'broll', type: 'video', track: 2, sourceUrl: '/uploads/videos/b.mp4', startTime: 2, endTime: 4 },
    ];
    expect(selectPrimarySegments(segs).map((s) => s.id)).toEqual(['main']);
  });

  it('builds a time-gated, PTS-aligned, full-frame video overlay chain', () => {
    const { chains } = buildBrollOverlaySegment(
      { sourceUrl: '/uploads/videos/b.mp4', startTime: 2, endTime: 4, sourceStartTime: 1, playbackSpeed: 1 },
      3, 'vbase', 'vout', 1920, 1080
    );
    const graph = chains.join(';');
    expect(graph).toMatch(/\[3:v\]trim=start=1\.000:end=3\.000/); // trims from sourceStartTime for the window length
    expect(graph).toMatch(/setpts=\(PTS-STARTPTS\)\/1\.0000\+2\.000\/TB/); // aligned to startTime on the output clock
    expect(graph).toMatch(/scale=1920:1080:force_original_aspect_ratio=decrease/);
    expect(graph).toMatch(/overlay=0:0:enable='between\(t\\,2\.000\\,4\.000\)'/); // covers ONLY its window
  });
});
