const { buildDrawTextFilter, pickHighlightWords, stripEmoji, extractEmoji, getEmojiFontPath } = require('../../../server/services/videoRenderService');

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

  it('applies a safe-zone clamp to keep captions clear of the UI band', () => {
    const f = buildDrawTextFilter({ text: 'CAPTION', style: 'default' }, { width: 1080, height: 1920 });
    expect(f).toMatch(/max\(h\*0\.04/);
    expect(f).toMatch(/h\*0\.92-text_h/);
  });

  it('safeZone:false opts out of the clamp (explicit editor placement)', () => {
    const f = buildDrawTextFilter({ text: 'EXACT', x: 50, y: 95, safeZone: false }, { width: 1080, height: 1920 });
    expect(f).not.toMatch(/max\(h\*0\.04/);
  });
});

describe('buildDrawTextFilter — word-by-word (karaoke) captions', () => {
  const words = [
    { word: 'GO', start: 0.0, end: 0.4 },
    { word: 'VIRAL', start: 0.4, end: 0.9 },
    { word: 'NOW', start: 0.9, end: 1.3 },
  ];

  it('emits one synced drawtext per word, timed to its window', () => {
    const f = buildDrawTextFilter({ words, captionMode: 'word', style: 'hook' }, { width: 1080, height: 1920 });
    const count = (f.match(/drawtext=/g) || []).length;
    expect(count).toBe(3); // one per word (each short word = single line)
    // each word is gated to its own time window
    expect(f).toMatch(/between\(t\\,0\.000\\,0\.400\)/);
    expect(f).toMatch(/between\(t\\,0\.400\\,0\.900\)/);
    expect(f).toMatch(/between\(t\\,0\.900\\,1\.300\)/);
  });

  it('also accepts the karaoke flag + {text,startTime,endTime} word shape', () => {
    const f = buildDrawTextFilter({
      karaoke: true,
      words: [{ text: 'HELLO', startTime: 1, endTime: 1.5 }, { text: 'WORLD', startTime: 1.5, endTime: 2 }],
    }, { width: 720, height: 1280 });
    expect((f.match(/drawtext=/g) || []).length).toBe(2);
  });

  it('skips words with missing text or invalid timing (no crash)', () => {
    const f = buildDrawTextFilter({
      captionMode: 'word',
      words: [{ word: '', start: 0, end: 1 }, { word: 'OK', start: 2, end: 1 }, { word: 'GOOD', start: 3, end: 3.5 }],
    }, { width: 1080, height: 1920 });
    expect((f.match(/drawtext=/g) || []).length).toBe(1); // only GOOD is valid
  });
});

describe('buildDrawTextFilter — captionPreset (editor one-click style)', () => {
  it('captionPreset drives the CAPTION_STYLE_MAP look (hook = gold)', () => {
    const f = buildDrawTextFilter({ text: 'BUY NOW', captionPreset: 'hook' }, { width: 1080, height: 1920 });
    expect(f).toMatch(/fontcolor='#FFD700'/);
  });

  it('captionPreset takes precedence over a generic visual style', () => {
    // style:'neon' isn't a caption key; captionPreset:'stat' should win → cyan.
    const f = buildDrawTextFilter({ text: '10X ROI', style: 'neon', captionPreset: 'stat' }, { width: 1080, height: 1920 });
    expect(f).toMatch(/fontcolor='#00FFFF'/);
  });
});

describe('caption keyword highlighting (karaoke)', () => {
  const words = [
    { word: 'this', start: 0, end: 0.3 },
    { word: 'MONEY', start: 0.3, end: 0.7 },
    { word: 'hack', start: 0.7, end: 1.1 },
  ];

  it('renders highlighted keywords in the accent colour, others in base', () => {
    const f = buildDrawTextFilter({
      captionMode: 'word', words, color: '#FFFFFF',
      highlightWords: ['money', 'hack'], highlightColor: '#39FF14',
    }, { width: 1080, height: 1920 });
    // 3 per-word drawtext; the two keywords use the accent colour (ffmpeg 0x form).
    expect((f.match(/drawtext=/g) || []).length).toBe(3);
    expect((f.match(/fontcolor='0x39ff14'/gi) || []).length).toBe(2);
    expect(f).toMatch(/fontcolor='0xffffff'/i); // the non-keyword stays base
  });

  it('does nothing without a highlightColor', () => {
    const f = buildDrawTextFilter({ captionMode: 'word', words, highlightWords: ['money'] }, { width: 1080, height: 1920 });
    expect(f).not.toMatch(/0x39ff14/i);
  });
});

describe('caption emoji (export safety)', () => {
  it('strips emoji from the body text so the body font never renders a tofu box', () => {
    expect(stripEmoji('MAKE MONEY 💰🔥')).toBe('MAKE MONEY');
    expect(extractEmoji('MAKE MONEY 💰🔥')).toBe('💰🔥');
  });

  it('a caption WITH an emoji renders the body text WITHOUT the emoji (no tofu)', () => {
    const f = buildDrawTextFilter({ text: 'GET RICH 💰', style: 'hook' }, { width: 1080, height: 1920 });
    expect(f).toContain('GET RICH');
    // The body drawtext text must not include the emoji codepoint.
    const bodyText = /text='([^']*)'/.exec(f)[1];
    expect(/\p{Extended_Pictographic}/u.test(bodyText)).toBe(false);
  });

  it('emoji rendering is gated on an emoji font (honest skip when absent)', () => {
    const f = buildDrawTextFilter({ text: 'WORDS', emoji: '🔥' }, { width: 1080, height: 1920 });
    const drawCount = (f.match(/drawtext=/g) || []).length;
    // 1 body line; +1 emoji drawtext ONLY when an emoji font exists on this host.
    expect(drawCount).toBe(getEmojiFontPath() ? 2 : 1);
  });

  it('never returns a broken/empty filter for an emoji-only caption', () => {
    const f = buildDrawTextFilter({ text: '🔥🔥' }, { width: 1080, height: 1920 });
    // emoji-only → either a single emoji drawtext (font present) or null (no font) — never ',,'.
    expect(f === null || /^drawtext=/.test(f)).toBe(true);
  });
});

describe('pickHighlightWords (pure)', () => {
  it('picks power words / numbers / longer content words', () => {
    const picks = pickHighlightWords('this is the secret to make 10000 dollars fast', 3);
    expect(picks).toEqual(expect.arrayContaining(['secret', '10000']));
    expect(picks.length).toBeLessThanOrEqual(3);
  });
  it('is safe + deduped on empty / filler-only text', () => {
    expect(pickHighlightWords('')).toEqual([]);
    expect(Array.isArray(pickHighlightWords('a an the of to is'))).toBe(true);
  });
});
