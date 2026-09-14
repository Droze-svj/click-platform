// json2video returns MEASURED per-word boundaries as karaoke ASS, and the
// pipeline used to discard them and re-invent word timings by dividing each
// segment evenly. Word-by-word captions rendered from that estimate look
// visibly out of sync. These lock in that real timings are kept when present,
// and that the estimate is still used (and labelled) when they are not.

const { _internal } = require('../../server/services/aiTranscriptionService');
const { parseAssToWords, parseAssToSegments, synthesizeWords } = _internal;

// A karaoke file in the shape this pipeline documents: one Dialogue row per
// word, the active word wrapped in a style override.
const KARAOKE_ASS = [
  '[Script Info]',
  'ScriptType: v4.00+',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:01.40,Default,,0,0,0,,{\\rHi}Know{\\r} what\'s so crazy,',
  'Dialogue: 0,0:00:01.40,0:00:01.80,Default,,0,0,0,,Know {\\rHi}what\'s{\\r} so crazy,',
  'Dialogue: 0,0:00:01.80,0:00:02.10,Default,,0,0,0,,Know what\'s {\\rHi}so{\\r} crazy,',
  'Dialogue: 0,0:00:02.10,0:00:02.60,Default,,0,0,0,,Know what\'s so {\\rHi}crazy,{\\r}',
].join('\n');

const PLAIN_ASS = [
  '[Script Info]',
  'ScriptType: v4.00+',
  '',
  '[Events]',
  'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  'Dialogue: 0,0:00:01.00,0:00:02.60,Default,,0,0,0,,Know what\'s so crazy,',
  'Dialogue: 0,0:00:02.60,0:00:04.00,Default,,0,0,0,,it actually worked.',
].join('\n');

describe('parseAssToWords', () => {
  it('recovers the real per-word boundaries the dedupe used to destroy', () => {
    const words = parseAssToWords(KARAOKE_ASS);
    expect(words.map((w) => w.word)).toEqual(['Know', "what's", 'so', 'crazy,']);
  });

  it('keeps the MEASURED timings, not an even division', () => {
    const words = parseAssToWords(KARAOKE_ASS);
    expect(words[0]).toMatchObject({ start: 1.0, end: 1.4 });
    expect(words[1]).toMatchObject({ start: 1.4, end: 1.8 });
    // 'so' is genuinely shorter than the others — an even split would have
    // given all four words an identical 0.4s duration.
    expect(words[2].end - words[2].start).toBeCloseTo(0.3, 3);
    expect(words[3].end - words[3].start).toBeCloseTo(0.5, 3);
  });

  it('is measurably better than the estimate it replaces', () => {
    const measured = parseAssToWords(KARAOKE_ASS);
    const estimated = synthesizeWords(parseAssToSegments(KARAOKE_ASS));
    const durations = (ws) => ws.map((w) => Number((w.end - w.start).toFixed(3)));
    // The estimate gives every word the same duration; the real data does not.
    expect(new Set(durations(estimated)).size).toBe(1);
    expect(new Set(durations(measured)).size).toBeGreaterThan(1);
  });

  it('returns [] for a file with no karaoke markers, so the caller can fall back', () => {
    expect(parseAssToWords(PLAIN_ASS)).toEqual([]);
  });

  it('degrades safely on junk input', () => {
    expect(parseAssToWords('')).toEqual([]);
    expect(parseAssToWords(null)).toEqual([]);
    expect(parseAssToWords('not an ass file at all')).toEqual([]);
    expect(parseAssToWords('[Events]\nDialogue: garbage')).toEqual([]);
  });

  it('ignores rows whose end is not after its start', () => {
    const bad = [
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:02.00,0:00:01.00,Default,,0,0,0,,{\\rHi}backwards{\\r}',
    ].join('\n');
    expect(parseAssToWords(bad)).toEqual([]);
  });

  it('still parses when the caption text contains commas', () => {
    // The Text column is last and may contain commas — a naive split breaks it.
    const words = parseAssToWords(KARAOKE_ASS);
    expect(words[3].word).toBe('crazy,');
  });

  it('does not disturb the existing segment parse', () => {
    // parseAssToSegments must keep collapsing karaoke repeats into phrases;
    // word extraction is additive, not a replacement.
    const segments = parseAssToSegments(KARAOKE_ASS);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("Know what's so crazy,");
  });
});
