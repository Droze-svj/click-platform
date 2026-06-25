const { buildDrawTextFilter } = require('../../../server/services/videoRenderService');

function fontsizeOf(filter) {
  const m = /fontsize=(\d+)/.exec(filter || '');
  return m ? Number(m[1]) : null;
}

describe('buildDrawTextFilter — auto-fit / auto-adjust across aspect ratios', () => {
  it('scales font proportionally with frame width (9:16 vs 16:9)', () => {
    const o = { text: 'HOOK', style: 'hook' };
    const small = fontsizeOf(buildDrawTextFilter(o, { width: 540, height: 960 }));
    const large = fontsizeOf(buildDrawTextFilter(o, { width: 1920, height: 1080 }));
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it('shrinks long text so it fits the frame width (no off-edge overflow)', () => {
    const W = 1080;
    const longText = 'THIS IS A VERY LONG CAPTION THAT WOULD OVERFLOW THE FRAME WIDTH';
    const shortF = fontsizeOf(buildDrawTextFilter({ text: 'GO', style: 'default' }, { width: W, height: 1920 }));
    const longF = fontsizeOf(buildDrawTextFilter({ text: longText, style: 'default' }, { width: W, height: 1920 }));
    expect(longF).toBeLessThan(shortF);
    // The rendered line width (≈ fontSize * chars * 0.58) must stay inside the frame.
    expect(longF * longText.length * 0.58).toBeLessThanOrEqual(W);
  });

  it('positions vertically relative to frame HEIGHT (not a fixed px offset)', () => {
    const f = buildDrawTextFilter({ text: 'HELLO', style: 'default' }, { width: 1080, height: 1080 });
    expect(f).toMatch(/h\*0\.1667/);   // height-relative bottom offset
    expect(f).not.toMatch(/-320(\D|$)/); // not the old fixed -320px
  });

  it('clamps out-of-range x/y into a safe on-frame margin', () => {
    const f = buildDrawTextFilter({ text: 'HI', x: 150, y: -20 }, { width: 1080, height: 1920 });
    expect(f).toMatch(/\(w-text_w\)\*0\.98/); // x 150 → clamped 98%
    expect(f).toMatch(/\(h-text_h\)\*0\.02/); // y -20 → clamped 2%
  });

  it('clamps font to a readable floor and a height-based ceiling', () => {
    const f = fontsizeOf(buildDrawTextFilter({ text: 'X', style: 'hook' }, { width: 4000, height: 400 }));
    expect(f).toBeLessThanOrEqual(Math.round(400 / 6));
    expect(f).toBeGreaterThanOrEqual(14);
  });

  it('defaults to 9:16 when no dims are passed (legacy callers unaffected)', () => {
    const f = buildDrawTextFilter({ text: 'LEGACY', style: 'default' });
    expect(fontsizeOf(f)).toBeGreaterThan(0);
  });

  it('returns null for empty text', () => {
    expect(buildDrawTextFilter({ text: '   ' }, { width: 1080, height: 1920 })).toBeNull();
  });
});
