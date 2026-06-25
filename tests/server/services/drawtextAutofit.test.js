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

  it('WRAPS long text into multiple stacked lines (big + readable, not shrunk tiny)', () => {
    const W = 1080;
    const longText = 'THIS IS A VERY LONG CAPTION THAT WOULD OVERFLOW THE FRAME WIDTH';
    const f = buildDrawTextFilter({ text: longText, style: 'default' }, { width: W, height: 1920 });
    // Multiple stacked drawtext filters = wrapped into lines.
    const lineCount = (f.match(/drawtext=/g) || []).length;
    expect(lineCount).toBeGreaterThan(1);
    expect(lineCount).toBeLessThanOrEqual(3);
    // Font stays readable (wrapping keeps it big rather than shrinking to tiny).
    expect(fontsizeOf(f)).toBeGreaterThanOrEqual(40);
  });

  it('keeps short text on a single line', () => {
    const f = buildDrawTextFilter({ text: 'GO VIRAL', style: 'hook' }, { width: 1080, height: 1920 });
    expect((f.match(/drawtext=/g) || []).length).toBe(1);
  });

  it('stacks wrapped lines around the base y (vertical offsets present)', () => {
    const f = buildDrawTextFilter(
      { text: 'WRAP THIS LONGER CAPTION ACROSS A FEW LINES PLEASE NOW', style: 'default' },
      { width: 720, height: 1280 },
    );
    // At least one line is offset from the base y (a +(NNN) or +(-NNN) shift).
    expect(f).toMatch(/\)\+\(-?\d+\)/);
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
