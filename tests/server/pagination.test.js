const { clampInt } = require('../../server/utils/pagination');

describe('pagination.clampInt', () => {
  it('returns the default for non-finite input (NaN / undefined / null)', () => {
    expect(clampInt('abc', 20)).toBe(20);
    expect(clampInt(undefined, 20)).toBe(20);
    expect(clampInt(null, 25)).toBe(25);
    expect(clampInt('', 10)).toBe(10);
  });
  it('caps an absurd value at max (DoS guard)', () => {
    expect(clampInt('999999999', 20)).toBe(500);
    expect(clampInt('1000', 20, 100)).toBe(100);
  });
  it('floors a below-min value at min (default min 1)', () => {
    expect(clampInt('-5', 20)).toBe(1);
    expect(clampInt('0', 20)).toBe(1);
  });
  it('passes a normal in-range value through (truncated to int)', () => {
    expect(clampInt('50', 20)).toBe(50);
    expect(clampInt('12.9', 20)).toBe(12);
    expect(clampInt(30, 20)).toBe(30);
  });
});
