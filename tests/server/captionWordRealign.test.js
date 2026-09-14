// Editing a caption used to destroy every word timing in the transcript, which
// silently downgraded karaoke captions to static blocks — recoverable only by
// paying for another transcription. These lock in that a word survives an edit
// whenever it was still spoken inside a surviving segment.

const { realignWordsToSegments } = require('../../server/utils/subtitleUtils');

const WORDS = [
  { word: 'this', start: 0.0, end: 0.4 },
  { word: 'is', start: 0.4, end: 0.7 },
  { word: 'insane', start: 0.7, end: 1.3 },
  { word: 'value', start: 1.3, end: 2.0 },
  { word: 'later', start: 5.0, end: 5.5 },
];

describe('realignWordsToSegments', () => {
  it('keeps every word when the segments still cover the same span', () => {
    // The exact case the old rule got wrong: splitting one segment into two
    // changed the COUNT, so all word timings were discarded even though every
    // word was still spoken inside the captions.
    const segments = [
      { start: 0, end: 1.0, text: 'this is' },
      { start: 1.0, end: 2.0, text: 'insane value' },
    ];
    const out = realignWordsToSegments(WORDS, segments);
    expect(out.map((w) => w.word)).toEqual(['this', 'is', 'insane', 'value']);
  });

  it('drops only the words whose region was removed', () => {
    const segments = [{ start: 0, end: 2.0, text: 'this is insane value' }];
    const out = realignWordsToSegments(WORDS, segments);
    expect(out.map((w) => w.word)).not.toContain('later');
    expect(out).toHaveLength(4);
  });

  it('returns word timings UNMODIFIED — never clamped to the segment', () => {
    // Clamping would move a word off the instant it was spoken, which is
    // precisely the drift karaoke makes visible.
    const segments = [{ start: 0.5, end: 1.5, text: 'is insane' }];
    const out = realignWordsToSegments(WORDS, segments);
    const insane = out.find((w) => w.word === 'insane');
    expect(insane.start).toBe(0.7);
    expect(insane.end).toBe(1.3);
  });

  it('keeps a word that straddles a segment edge within tolerance', () => {
    const segments = [{ start: 0.75, end: 2.0, text: 'insane value' }];
    const out = realignWordsToSegments(WORDS, segments);
    // 'insane' starts at 0.70, just before the segment — it is still spoken here.
    expect(out.map((w) => w.word)).toContain('insane');
  });

  it('does NOT keep a word that merely starts where the segment ends', () => {
    // Real transcripts put each word's end exactly on the next word's start.
    // An "any overlap" rule counted 'insane' (0.7–1.3) as inside a segment that
    // ENDS at 0.7, so trimming the tail of a caption always kept the first word
    // you deleted. Caught by the PUT route test, not by this file.
    const out = realignWordsToSegments(WORDS, [{ start: 0, end: 0.7, text: 'this is' }]);
    expect(out.map((w) => w.word)).toEqual(['this', 'is']);
  });

  it('does not keep a word that merely ends where the segment starts', () => {
    const out = realignWordsToSegments(WORDS, [{ start: 1.3, end: 2.0, text: 'value' }]);
    expect(out.map((w) => w.word)).toEqual(['value']);
  });

  it('survives merging many segments into one', () => {
    const out = realignWordsToSegments(WORDS, [{ start: 0, end: 6, text: 'everything' }]);
    expect(out).toHaveLength(5);
  });

  it('degrades safely on empty or malformed input', () => {
    expect(realignWordsToSegments([], [{ start: 0, end: 1 }])).toEqual([]);
    expect(realignWordsToSegments(WORDS, [])).toEqual([]);
    expect(realignWordsToSegments(null, null)).toEqual([]);
    expect(realignWordsToSegments(WORDS, [{ start: NaN, end: 1 }])).toEqual([]);
  });

  it('skips words with broken time windows rather than emitting them', () => {
    const broken = [
      { word: 'ok', start: 0, end: 0.5 },
      { word: 'reversed', start: 1, end: 0.2 },
      { word: 'nan', start: NaN, end: 1 },
    ];
    const out = realignWordsToSegments(broken, [{ start: 0, end: 2 }]);
    expect(out.map((w) => w.word)).toEqual(['ok']);
  });

  it('accepts the startTime/endTime word shape too', () => {
    const alt = [{ text: 'alt', startTime: 0.1, endTime: 0.4 }];
    const out = realignWordsToSegments(alt, [{ start: 0, end: 1 }]);
    expect(out).toHaveLength(1);
  });
});
