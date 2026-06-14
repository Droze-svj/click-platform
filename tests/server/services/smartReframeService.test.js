// Unit tests for smartReframeService.computeReframe — the pure aspect-ratio
// geometry behind subject-aware multi-format reframing. No ffmpeg / I/O here.

const { computeReframe } = require('../../../server/services/smartReframeService');

describe('smartReframeService.computeReframe', () => {
  const isEven = (n) => n % 2 === 0;

  it('produces exactly the target crop size for a 16:9 → 9:16 reframe', () => {
    const g = computeReframe(1920, 1080, 1080, 1920, 0.5, 0.5);
    expect(g.cropW).toBe(1080);
    expect(g.cropH).toBe(1920);
    // Cover-scale keeps full height, overflows width → height matches target.
    expect(g.scaleH).toBe(1920);
    expect(g.scaleW).toBeGreaterThanOrEqual(1080);
  });

  it('keeps the crop window fully inside the scaled frame for any subject x', () => {
    for (const sx of [0, 0.25, 0.5, 0.75, 1]) {
      const g = computeReframe(1920, 1080, 1080, 1920, sx, 0.5);
      expect(g.cropX).toBeGreaterThanOrEqual(0);
      expect(g.cropX).toBeLessThanOrEqual(g.scaleW - g.cropW);
    }
  });

  it('pins the crop to the left edge when the subject is hard-left (offset 0, not 2)', () => {
    const g = computeReframe(1920, 1080, 1080, 1920, 0.0, 0.5);
    expect(g.cropX).toBe(0);
  });

  it('pins the crop to the right edge when the subject is hard-right', () => {
    const g = computeReframe(1920, 1080, 1080, 1920, 1.0, 0.5);
    expect(g.cropX).toBe(g.scaleW - g.cropW);
  });

  it('reframes portrait → 16:9 by cropping vertically on the subject', () => {
    const top = computeReframe(1080, 1920, 1920, 1080, 0.5, 0.0);
    expect(top.cropW).toBe(1920);
    expect(top.cropH).toBe(1080);
    expect(top.scaleW).toBe(1920);
    expect(top.cropY).toBe(0); // subject at top → window pinned to top
  });

  it('is a no-op crop for equal aspect ratios (1:1 → 1:1)', () => {
    const g = computeReframe(1080, 1080, 1080, 1080, 0.5, 0.5);
    expect(g.cropX).toBe(0);
    expect(g.cropY).toBe(0);
    expect(g.scaleW).toBe(1080);
    expect(g.scaleH).toBe(1080);
  });

  it('always returns even, h264-safe dimensions and offsets', () => {
    const samples = [
      computeReframe(1280, 720, 1080, 1920, 0.3, 0.6),
      computeReframe(720, 1280, 1080, 1350, 0.7, 0.2),
      computeReframe(1920, 1080, 1080, 1080, 0.5, 0.5),
      computeReframe(1001, 999, 1080, 1920, 0.5, 0.5), // odd source dims
    ];
    for (const g of samples) {
      expect(isEven(g.scaleW)).toBe(true);
      expect(isEven(g.scaleH)).toBe(true);
      expect(isEven(g.cropX)).toBe(true);
      expect(isEven(g.cropY)).toBe(true);
    }
  });

  it('defaults a missing/NaN subject centre to the frame centre', () => {
    const g = computeReframe(1920, 1080, 1080, 1920, undefined, NaN);
    const centered = computeReframe(1920, 1080, 1080, 1920, 0.5, 0.5);
    expect(g.cropX).toBe(centered.cropX);
    expect(g.cropY).toBe(centered.cropY);
  });
});
