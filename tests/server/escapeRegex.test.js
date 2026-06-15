// escapeRegex neutralizes regex metacharacters (ReDoS) before user input is used
// as a Mongo $regex / RegExp source, and caps length.

const { escapeRegex } = require('../../server/utils/escapeRegex');

test('escapes every regex metacharacter so the pattern is a literal', () => {
  const out = escapeRegex('(a+)+$');
  expect(out).toBe('\\(a\\+\\)\\+\\$');
  // the escaped string compiles to a literal matcher, not a backtracking bomb
  expect(new RegExp(out).test('(a+)+$')).toBe(true);
  expect(new RegExp(out).test('aaaa')).toBe(false);
});

test('handles the other dangerous metacharacters', () => {
  expect(escapeRegex('.*?^${}()|[]\\')).toBe('\\.\\*\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
});

test('caps length and tolerates null/undefined', () => {
  expect(escapeRegex('a'.repeat(500)).length).toBe(128);
  expect(escapeRegex(null)).toBe('');
  expect(escapeRegex(undefined)).toBe('');
});

test('leaves a plain alphanumeric query unchanged', () => {
  expect(escapeRegex('hello world 123')).toBe('hello world 123');
});
