// Export encoder selection + output options: correctness, broad playback
// compatibility, and safe hardware-accelerated encoding (NVENC/VideoToolbox) with
// a software fallback.

const {
  buildVideoOutputOptions,
  resolveVideoEncoder,
} = require('../../server/services/videoRenderService');

const joined = (opts) => opts.join(' ');

describe('resolveVideoEncoder (hardware selection + fallback)', () => {
  it('uses the software codec by default (hardware not opted-in)', () => {
    expect(resolveVideoEncoder({ codec: 'libx264', preferHardware: false, encoders: { h264_nvenc: 1 } }))
      .toEqual({ encoder: 'libx264', family: 'sw' });
  });

  it('ProRes always resolves to prores_ks regardless of hardware', () => {
    expect(resolveVideoEncoder({ isProres: true, preferHardware: true, encoders: { h264_nvenc: 1 } }))
      .toEqual({ encoder: 'prores_ks', family: 'prores' });
  });

  it('prefers NVENC when opted-in and present (H.264 + H.265)', () => {
    const enc = { h264_nvenc: 1, hevc_nvenc: 1, h264_videotoolbox: 1 };
    expect(resolveVideoEncoder({ codec: 'libx264', preferHardware: true, encoders: enc }))
      .toEqual({ encoder: 'h264_nvenc', family: 'nvenc' });
    expect(resolveVideoEncoder({ codec: 'libx265', preferHardware: true, encoders: enc }))
      .toEqual({ encoder: 'hevc_nvenc', family: 'nvenc' });
  });

  it('falls to VideoToolbox when NVENC is absent but VT is present', () => {
    expect(resolveVideoEncoder({ codec: 'libx264', preferHardware: true, encoders: { h264_videotoolbox: 1 } }))
      .toEqual({ encoder: 'h264_videotoolbox', family: 'videotoolbox' });
  });

  it('falls back to software when opted-in but NO hardware encoder exists', () => {
    expect(resolveVideoEncoder({ codec: 'libx264', preferHardware: true, encoders: {} }))
      .toEqual({ encoder: 'libx264', family: 'sw' });
  });
});

describe('buildVideoOutputOptions per family', () => {
  it('software H.264: -preset + CRF + VBV cap + yuv420p + high + faststart; no -b:v/-cq', () => {
    const o = joined(buildVideoOutputOptions({ family: 'sw', codec: 'libx264', crf: 23, preset: 'slow', bitrateMbps: 8 }));
    expect(o).toContain('-preset slow');
    expect(o).toContain('-crf 23');
    expect(o).toContain('-maxrate 8M');
    expect(o).toContain('-bufsize 16M');
    expect(o).toContain('-pix_fmt yuv420p');
    expect(o).toContain('-profile:v high');
    expect(o).toContain('-max_muxing_queue_size 9999');
    expect(o).toContain('-movflags +faststart');
    expect(o).not.toContain('-b:v');
    expect(o).not.toContain('-cq');
  });

  it('software H.265: yuv420p but no H.264-only -profile:v high', () => {
    const o = joined(buildVideoOutputOptions({ family: 'sw', codec: 'libx265', crf: 20 }));
    expect(o).toContain('-crf 20');
    expect(o).toContain('-pix_fmt yuv420p');
    expect(o).not.toContain('-profile:v high');
  });

  it('NVENC: constant-quality VBR (-rc vbr -cq -b:v 0) + cap, NOT -crf', () => {
    const o = joined(buildVideoOutputOptions({ family: 'nvenc', codec: 'libx264', crf: 21, preset: 'slow', bitrateMbps: 10 }));
    expect(o).toContain('-rc vbr');
    expect(o).toContain('-cq 21');
    expect(o).toContain('-b:v 0');
    expect(o).toContain('-maxrate 10M');
    expect(o).toContain('-preset slow');
    expect(o).toContain('-pix_fmt yuv420p');
    expect(o).not.toContain('-crf');
  });

  it('VideoToolbox: bitrate-driven, NO -preset and NO -crf (it rejects them)', () => {
    const o = joined(buildVideoOutputOptions({ family: 'videotoolbox', codec: 'libx264', bitrateMbps: 12 }));
    expect(o).toContain('-b:v 12M');
    expect(o).toContain('-maxrate 12M');
    expect(o).toContain('-pix_fmt yuv420p');
    expect(o).not.toContain('-preset');
    expect(o).not.toContain('-crf');
    expect(o).not.toContain('-cq');
  });

  it('ProRes: own profile/vendor, NOT pix_fmt-forced (would corrupt it)', () => {
    const o = joined(buildVideoOutputOptions({ isProres: true }));
    expect(o).toContain('-profile:v 3');
    expect(o).toContain('-vendor apl0');
    expect(o).toContain('-max_muxing_queue_size 9999');
    expect(o).not.toContain('-pix_fmt');
    expect(o).not.toContain('-crf');
  });

  it('clamps a missing/bogus bitrate to a sane cap', () => {
    expect(joined(buildVideoOutputOptions({ bitrateMbps: 0 }))).toContain('-maxrate 8M');
    expect(joined(buildVideoOutputOptions({ bitrateMbps: 20 }))).toContain('-bufsize 40M');
  });
});
