// The ASS caption engine replaces a drawtext path that could not animate scale,
// showed one word at a time, and guessed font metrics. These tests lock in the
// format details that are easy to get silently wrong (centisecond timing, the
// BGR colour order, override-block escaping) and the behaviours that ARE the
// feature: full-line context with an emphasised active word, a real scale pop,
// and an honest static fallback when there are no word timings.

const ass = require('../../server/services/assCaptionRenderer');

const wordsFor = (pairs) => pairs.map(([word, start, end]) => ({ word, start, end }));

const FOUR_WORDS = wordsFor([
  ['this', 1.0, 1.2],
  ['is', 1.2, 1.35],
  ['insane', 1.35, 1.8],
  ['value', 1.8, 2.3],
]);

const dialogues = (doc) => doc.split('\n').filter((l) => l.startsWith('Dialogue:'));

describe('assCaptionRenderer — time format', () => {
  it('emits H:MM:SS.cc with CENTISECONDS, not decimal seconds', () => {
    expect(ass.secondsToAssTime(0)).toBe('0:00:00.00');
    expect(ass.secondsToAssTime(1.23)).toBe('0:00:01.23');
    // 0.8s is 80 centiseconds — the exact trap that misreads as 0.08s.
    expect(ass.secondsToAssTime(0.8)).toBe('0:00:00.80');
    expect(ass.secondsToAssTime(61.5)).toBe('0:01:01.50');
    expect(ass.secondsToAssTime(3661.07)).toBe('1:01:01.07');
  });

  it('carries instead of emitting an invalid .100 when rounding up', () => {
    expect(ass.secondsToAssTime(1.999)).toBe('0:00:02.00');
    expect(ass.secondsToAssTime(59.999)).toBe('0:01:00.00');
  });

  it('round-trips against the existing ASS time parser', () => {
    const { secondsToAssTime } = ass;
    for (const sec of [0, 0.08, 1.23, 12.5, 61.5, 3661.07]) {
      const [h, m, rest] = secondsToAssTime(sec).split(':');
      const back = Number(h) * 3600 + Number(m) * 60 + Number(rest);
      expect(back).toBeCloseTo(sec, 2);
    }
  });

  it('never emits a negative time', () => {
    expect(ass.secondsToAssTime(-5)).toBe('0:00:00.00');
  });
});

describe('assCaptionRenderer — text safety', () => {
  it('neutralises override-block braces so a caption cannot inject styling', () => {
    const out = ass.escapeAssText('hello {\\fscx900} world');
    expect(out).not.toContain('{');
    expect(out).not.toContain('}');
    // The backslash that would start an override tag is gone too.
    expect(out).not.toMatch(/\\(?!N)/);
  });

  it('converts real newlines to the ASS line break', () => {
    expect(ass.escapeAssText('one\ntwo')).toBe('one\\Ntwo');
    expect(ass.escapeAssText('one\r\ntwo')).toBe('one\\Ntwo');
  });

  it('leaves ordinary text (including emoji and CJK) untouched', () => {
    expect(ass.escapeAssText('Hello 🔥 世界')).toBe('Hello 🔥 世界');
  });

  it('matches words Unicode-aware, so accents and non-Latin still highlight', () => {
    expect(ass.normWord('¡Café!')).toBe('café');
    expect(ass.normWord('“MONEY”')).toBe('money');
    expect(ass.normWord('日本語')).toBe('日本語');
  });
});

describe('assCaptionRenderer — document structure', () => {
  const doc = ass.buildAssDocument({
    captions: [{ text: 'this is insane value', start: 1, end: 2.3, words: FOUR_WORDS }],
    styleId: 'hormozi',
    frame: { width: 1080, height: 1920 },
  });

  it('declares PlayRes matching the output frame', () => {
    // If PlayRes drifts from the real frame, libass scales every margin and font
    // size against the wrong canvas.
    expect(doc).toContain('PlayResX: 1080');
    expect(doc).toContain('PlayResY: 1920');
  });

  it('has the required sections and a single style line', () => {
    expect(doc).toContain('[Script Info]');
    expect(doc).toContain('[V4+ Styles]');
    expect(doc).toContain('[Events]');
    expect(doc.match(/^Style:/gm)).toHaveLength(1);
  });

  it('style line field count matches its Format declaration', () => {
    const format = doc.match(/^Format: (Name.*)$/m)[1].split(',').length;
    const style = doc.match(/^Style: (.*)$/m)[1].split(',').length;
    expect(style).toBe(format);
  });

  it('scales PlayRes with the requested frame', () => {
    const small = ass.buildAssDocument({
      captions: [{ text: 'hi', start: 0, end: 1 }],
      styleId: 'default',
      frame: { width: 720, height: 1280 },
    });
    expect(small).toContain('PlayResX: 720');
    expect(small).toContain('PlayResY: 1280');
  });
});

describe('assCaptionRenderer — word karaoke (the headline behaviour)', () => {
  const doc = ass.buildAssDocument({
    captions: [{
      text: 'this is insane value',
      start: 1, end: 2.3,
      words: FOUR_WORDS,
      highlightWords: ['value'],
    }],
    styleId: 'hormozi',
    frame: { width: 1080, height: 1920 },
  });
  const lines = dialogues(doc);

  it('emits one event per word, each carrying the FULL line', () => {
    expect(lines).toHaveLength(4);
    // Every event contains all four words — this is what the old one-word-at-a-
    // time drawtext path could not do.
    for (const l of lines) {
      for (const w of ['THIS', 'IS', 'INSANE', 'VALUE']) expect(l).toContain(w);
    }
  });

  it('applies a real scale pop to the active word', () => {
    // \t() animating \fscx is precisely what drawtext could not express without
    // crashing ffmpeg, so its presence is the proof the ceiling is gone.
    expect(lines[0]).toMatch(/\\fscx118\\fscy118\\t\(0,\d+,\\fscx100\\fscy100\)/);
  });

  it('recolours the active word and resets afterwards', () => {
    // hormozi highlight #FFD700 → BGR &H00D7FF
    expect(lines[0]).toContain('\\c&H00D7FF');
    expect(lines[0]).toContain('{\\r}');
  });

  it('keeps a designated keyword accented even when it is not the active word', () => {
    // 'value' is a highlight word; on the FIRST event ('this' is active) it must
    // still carry the accent colour.
    const beforeValue = lines[0].slice(0, lines[0].indexOf('VALUE'));
    expect(beforeValue).toContain('\\c&H00D7FF');
  });

  it('holds each word until the next begins so the line never blanks', () => {
    // word 2 starts at 1.2 → word 1's event must end at 1.20, not earlier.
    expect(lines[0]).toContain('0:00:01.00,0:00:01.20');
  });

  it('uppercases when the style says so', () => {
    expect(lines[0]).toContain('INSANE');
    expect(lines[0]).not.toContain('insane');
  });
});

describe('assCaptionRenderer — sweep karaoke', () => {
  it('emits ONE event per line using native \\kf fill', () => {
    const doc = ass.buildAssDocument({
      captions: [{ text: 'this is insane value', start: 1, end: 2.3, words: FOUR_WORDS }],
      styleId: 'karaoke-fill',
      frame: { width: 1080, height: 1920 },
    });
    const lines = dialogues(doc);
    expect(lines).toHaveLength(1);
    expect((lines[0].match(/\\kf\d+/g) || [])).toHaveLength(4);
  });

  it('expresses \\kf durations in centiseconds', () => {
    const doc = ass.buildAssDocument({
      captions: [{ text: 'a b', start: 0, end: 1, words: wordsFor([['a', 0, 0.5], ['b', 0.5, 1]]) }],
      styleId: 'karaoke-fill',
      frame: { width: 1080, height: 1920 },
    });
    // 0.5s → 50cs
    expect(dialogues(doc)[0]).toContain('\\kf50');
  });
});

describe('assCaptionRenderer — honest fallbacks', () => {
  it('renders a static line when there are no word timings, without faking them', () => {
    const doc = ass.buildAssDocument({
      captions: [{ text: 'no timings here', start: 0, end: 2 }],
      styleId: 'hormozi',
      frame: { width: 1080, height: 1920 },
    });
    const lines = dialogues(doc);
    expect(lines).toHaveLength(1);
    // No karaoke tags invented from nothing — evenly-spaced fake sync reads as
    // out-of-time and is worse than a clean static caption.
    expect(lines[0]).not.toMatch(/\\kf?\d/);
  });

  it('ignores words with broken or reversed time windows', () => {
    const doc = ass.buildAssDocument({
      captions: [{
        text: 'a b', start: 0, end: 2,
        words: [
          { word: 'a', start: 0, end: 0.5 },
          { word: 'b', start: 1, end: 0.2 },      // reversed → dropped
          { word: 'c', start: NaN, end: 1 },      // not finite → dropped
          { word: '', start: 1, end: 1.5 },       // empty → dropped
        ],
      }],
      styleId: 'hormozi',
      frame: { width: 1080, height: 1920 },
    });
    expect(dialogues(doc)).toHaveLength(1);
  });

  it('splits a long line at the style word limit', () => {
    const many = wordsFor(
      'one two three four five six seven eight'.split(' ').map((w, i) => [w, i * 0.3, i * 0.3 + 0.3]),
    );
    const doc = ass.buildAssDocument({
      captions: [{ text: 'x', start: 0, end: 3, words: many }],
      styleId: 'hormozi',   // maxWordsPerLine: 4
      frame: { width: 1080, height: 1920 },
    });
    // 8 words → two lines of 4 → still one event per word.
    expect(dialogues(doc)).toHaveLength(8);
    // ...but no single event mixes words from both lines.
    expect(dialogues(doc)[0]).not.toContain('FIVE');
  });

  it('a static style never emits karaoke even when words exist', () => {
    const doc = ass.buildAssDocument({
      captions: [{ text: 'this is insane value', start: 1, end: 2.3, words: FOUR_WORDS }],
      styleId: 'clean-minimal',   // karaoke: 'none'
      frame: { width: 1080, height: 1920 },
    });
    expect(dialogues(doc)).toHaveLength(1);
    expect(dialogues(doc)[0]).not.toMatch(/\\kf?\d/);
  });

  it('returns null rather than an empty subtitle file when there is nothing to burn', () => {
    expect(ass.renderCaptionsToAss({ captions: [], styleId: 'hormozi' })).toBeNull();
    expect(ass.renderCaptionsToAss({ captions: null, styleId: 'hormozi' })).toBeNull();
    // Captions that produce no usable events must not leave a file behind either.
    expect(ass.renderCaptionsToAss({
      captions: [{ text: '   ', start: 0, end: 1 }], styleId: 'hormozi',
    })).toBeNull();
  });
});

describe('assCaptionRenderer — file lifecycle', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  it('writes into the render temp dir and cleans up idempotently', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ass-test-'));
    const res = ass.renderCaptionsToAss({
      captions: [{ text: 'hello there', start: 0, end: 1, words: wordsFor([['hello', 0, 0.5], ['there', 0.5, 1]]) }],
      styleId: 'hormozi',
      frame: { width: 1080, height: 1920 },
      tmpDir: dir,
    });
    expect(res).toBeTruthy();
    expect(res.path.startsWith(dir)).toBe(true);
    expect(fs.existsSync(res.path)).toBe(true);

    res.cleanup();
    expect(fs.existsSync(res.path)).toBe(false);
    // Calling cleanup twice must not throw — it runs from a `finally`.
    expect(() => res.cleanup()).not.toThrow();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
