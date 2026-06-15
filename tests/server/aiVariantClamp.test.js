// Regression for the critical AI cost-bomb: POST /api/ai/variants and /hooks read
// `count` from the body and issue one LLM call per iteration. An unclamped
// count (e.g. 100000) was 100k paid generations per request. clampCount bounds it.

const { clampCount } = require('../../server/routes/ai-content');

describe('ai-content clampCount — caps variant/hook fan-out', () => {
  test('clamps an absurd count to the hard max (10)', () => {
    expect(clampCount(100000)).toBe(10);
    expect(clampCount('99999')).toBe(10);
    expect(clampCount(11)).toBe(10);
  });

  test('keeps sane values and the default', () => {
    expect(clampCount(5)).toBe(5);
    expect(clampCount(1)).toBe(1);
    expect(clampCount(undefined)).toBe(5); // default
  });

  test('coerces garbage / negatives to a safe value', () => {
    expect(clampCount(0)).toBe(1);
    expect(clampCount(-5)).toBe(1);
    expect(clampCount('abc')).toBe(5);
    expect(clampCount(Infinity)).toBe(5); // parseInt(Infinity) → NaN → safe default
    expect(clampCount(NaN)).toBe(5);
  });
});
