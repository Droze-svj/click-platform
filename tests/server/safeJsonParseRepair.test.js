/**
 * safeJsonParse's truncation repair (server/utils/aiHelper.js).
 *
 * The repair exists for model output that stops mid-document. It rewinds to the
 * last position that is safely outside a string, then balances brackets. It used
 * to append a closing quote whenever the text *ended* inside a string — but the
 * rewind point is never inside one, so output cut off mid-string came back as
 * `…,"idea""}`, which can never parse. Every such response fell through to the
 * caller's fallback: for a value, a key, or an array element alike. That is how
 * POST /api/ai/generate-idea returned the 'Create engaging content.' filler.
 *
 * The first three cases below all returned the fallback before the fix.
 */

jest.mock('../../server/utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { safeJsonParse } = require('../../server/utils/aiHelper');

const FALLBACK = Object.freeze({ fallback: true });

describe('safeJsonParse truncation repair', () => {
  it('output cut inside a VALUE keeps the complete fields and drops the unfinished one', () => {
    // The exact shape behind the live generate-idea failure.
    const cut = '{\n  "title": "The What If Hook",\n  "idea": "Start with a bold claim tha';
    expect(safeJsonParse(cut, FALLBACK)).toEqual({ title: 'The What If Hook' });
  });

  it('output cut inside a KEY drops the partial key', () => {
    expect(safeJsonParse('{\n  "title": "The What If Hook",\n  "ide', FALLBACK))
      .toEqual({ title: 'The What If Hook' });
  });

  it('output cut inside an ARRAY element keeps the finished elements', () => {
    expect(safeJsonParse('{"title":"A","tags":["one","tw', FALLBACK))
      .toEqual({ title: 'A', tags: ['one'] });
  });

  it('a dangling key inside a NESTED object is dropped, not given an invented value', () => {
    expect(safeJsonParse('{"a":{"b":"x","c":"trunc', FALLBACK)).toEqual({ a: { b: 'x' } });
  });

  it('escaped quotes inside a completed value survive the repair', () => {
    expect(safeJsonParse('{"q":"he said \\"hi\\" twice","r":"cut', FALLBACK))
      .toEqual({ q: 'he said "hi" twice' });
  });

  it('a lone key cut in its value yields an empty object, not a fabricated value', () => {
    expect(safeJsonParse('{"idea":"Start with', FALLBACK)).toEqual({});
  });

  it('never presents half a string as a finished value', () => {
    const out = safeJsonParse('{"title":"T","idea":"Half a sentenc', FALLBACK);
    expect(out).not.toHaveProperty('idea');
  });

  describe('unchanged behaviour', () => {
    it('parses output cut right after a comma', () => {
      expect(safeJsonParse('{\n  "title": "The What If Hook",', FALLBACK))
        .toEqual({ title: 'The What If Hook' });
    });

    it('parses complete JSON inside a markdown fence', () => {
      expect(safeJsonParse('```json\n{"title":"A","idea":"B"}\n```', FALLBACK))
        .toEqual({ title: 'A', idea: 'B' });
    });

    it('returns already-valid JSON untouched', () => {
      expect(safeJsonParse('{"x":[1,2,{"y":"z"}]}', FALLBACK)).toEqual({ x: [1, 2, { y: 'z' }] });
    });

    it('drops an unfinished trailing element of a top-level array', () => {
      expect(safeJsonParse('[{"t":"one"},{"t":"tw', FALLBACK)).toEqual([{ t: 'one' }]);
    });

    it('returns the fallback for text that is not JSON at all', () => {
      expect(safeJsonParse('Sorry, I cannot help with that.', FALLBACK)).toBe(FALLBACK);
    });

    it('returns the fallback for empty input', () => {
      expect(safeJsonParse('', FALLBACK)).toBe(FALLBACK);
      expect(safeJsonParse(null, FALLBACK)).toBe(FALLBACK);
    });
  });
});
