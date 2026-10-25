// Auto edit cuts silences (or speed-ramps) inside the filter graph, then burns
// captions/overlays timed against the SOURCE. Without re-timing, every caption
// after the first cut appeared early. makeTimeMapper maps source → output time.
const { makeTimeMapper, buildCutFilter } = require('../../../server/services/aiVideoEditingService');

describe('auto-edit time mapping', () => {
  it('maps times across removed silences', () => {
    // keep 0.6–4.3, 6.8–10.7, 12.5–16.5 (the three spoken sentences)
    const { map, outDuration } = makeTimeMapper([
      { start: 0.6, end: 4.3, speed: 1 }, { start: 6.8, end: 10.7, speed: 1 }, { start: 12.5, end: 16.5, speed: 1 },
    ]);
    expect(outDuration).toBeCloseTo(3.7 + 3.9 + 4.0, 5);
    expect(map(0.6)).toBeCloseTo(0, 5);
    expect(map(7.0)).toBeCloseTo(3.7 + 0.2, 5);   // second sentence starts right after the first
    expect(map(5.5)).toBeCloseTo(3.7, 5);         // inside a removed gap → next kept start
    expect(map(13.0)).toBeCloseTo(3.7 + 3.9 + 0.5, 5);
  });

  it('accounts for speed changes', () => {
    const { map, outDuration } = makeTimeMapper([{ start: 0, end: 4, speed: 1 }, { start: 4, end: 8, speed: 2 }]);
    expect(outDuration).toBeCloseTo(6, 5);
    expect(map(6)).toBeCloseTo(5, 5);
  });

  it('leaves time unchanged when nothing was cut', () => {
    expect(makeTimeMapper(null).map(9.3)).toBe(9.3);
  });

  it('buildCutFilter returns the kept segments, and trims a single leading/trailing silence', () => {
    const cuts = buildCutFilter([{ start: 4.3, end: 6.8 }], [], 10);
    expect(cuts.segments).toEqual([{ start: 0, end: 4.3 }, { start: 6.8, end: 10 }]);
    const lead = buildCutFilter([{ start: 0, end: 0.6 }], [], 10);
    expect(lead.segments).toEqual([{ start: 0.6, end: 10 }]);
    expect(buildCutFilter([], [], 10)).toBeNull();
  });
});

const { buildSpokenCaptions, fitCaptionsToFrame } = require('../../../server/services/aiVideoEditingService');

describe('auto-edit captions are what was said, and fit the frame', () => {
  const words = 'Here is the first thing most creators get wrong about editing their videos.'.split(' ')
    .map((w, i) => ({ word: w, start: 0.6 + i * 0.28, end: 0.6 + i * 0.28 + 0.25 }))
    .concat('The second mistake is a slow hook.'.split(' ').map((w, i) => ({ word: w, start: 6.9 + i * 0.3, end: 6.9 + i * 0.3 + 0.27 })));

  it('builds short, non-overlapping lines from the spoken words', () => {
    const lines = buildSpokenCaptions(words);
    expect(lines.map((l) => l.text).join(' ')).toBe(words.map((w) => w.word).join(' '));
    lines.forEach((l, i) => {
      expect(l.text.length).toBeLessThanOrEqual(22);
      if (lines[i + 1]) expect(l.endTime).toBeLessThanOrEqual(lines[i + 1].startTime + 1e-9);
    });
    // a sentence boundary / long pause starts a new line
    expect(lines.some((l) => l.text.startsWith('The second'))).toBe(true);
  });

  it('splits lines wider than the frame and stops stacking', () => {
    const out = fitCaptionsToFrame([
      { text: 'Viewer retention is non-negotiable for every creator out there', startTime: 1, endTime: 5, style: 'default' },
      { text: 'Overlapping line', startTime: 4, endTime: 6, style: 'default' },
    ], { frameWidth: 1080 });
    out.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(Math.floor((1080 * 0.86) / (58 * 0.7))));
    const bottom = out.filter((c) => !c.position).sort((a, b) => a.startTime - b.startTime);
    for (let i = 0; i < bottom.length - 1; i++) expect(bottom[i].endTime).toBeLessThanOrEqual(bottom[i + 1].startTime + 1e-9);
  });
});
