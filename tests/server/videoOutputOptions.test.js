// Encoder output options for the final export: correctness + broad playback
// compatibility (the render used to omit -pix_fmt and set a contradictory -b:v).

const { buildVideoOutputOptions } = require('../../server/services/videoRenderService');

const joined = (opts) => opts.join(' ');

describe('buildVideoOutputOptions', () => {
  it('H.264: CRF + VBV cap, yuv420p, high profile, faststart — and NO dead -b:v', () => {
    const o = joined(buildVideoOutputOptions({ codec: 'libx264', crf: 23, bitrateMbps: 8 }));
    expect(o).toContain('-crf 23');
    expect(o).toContain('-maxrate 8M');
    expect(o).toContain('-bufsize 16M');   // 2× maxrate
    expect(o).toContain('-pix_fmt yuv420p'); // was missing → broke Safari/QuickTime/mobile
    expect(o).toContain('-profile:v high');
    expect(o).toContain('-movflags +faststart');
    expect(o).not.toContain('-b:v');       // x264 ignored it in CRF mode anyway
    expect(o).not.toContain('-preset');    // optimizeFFmpegCommand owns the preset
  });

  it('H.265: forces yuv420p but omits the H.264-only -profile:v high (libx265 rejects it)', () => {
    const o = joined(buildVideoOutputOptions({ codec: 'libx265', crf: 20, bitrateMbps: 12 }));
    expect(o).toContain('-pix_fmt yuv420p');
    expect(o).toContain('-crf 20');
    expect(o).toContain('-maxrate 12M');
    expect(o).not.toContain('-profile:v high');
  });

  it('ProRes: keeps its own profile/vendor and is not CRF/pix_fmt-encoded', () => {
    const o = joined(buildVideoOutputOptions({ isProres: true }));
    expect(o).toContain('-profile:v 3');
    expect(o).toContain('-vendor apl0');
    expect(o).not.toContain('-crf');
    expect(o).not.toContain('-pix_fmt');
  });

  it('clamps a missing/bogus bitrate to a sane default cap', () => {
    expect(joined(buildVideoOutputOptions({ bitrateMbps: 0 }))).toContain('-maxrate 8M');
    expect(joined(buildVideoOutputOptions({}))).toContain('-maxrate 8M');
    expect(joined(buildVideoOutputOptions({ bitrateMbps: 20 }))).toContain('-bufsize 40M');
  });
});
