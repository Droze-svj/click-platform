// Unit tests for the shared FFmpeg drawtext-safety helpers. These guard a real
// injection class: user text/colors/paths/exprs flowing into a single-quoted,
// colon-delimited drawtext filter string. Each helper must neutralize the
// characters that break out of an option (' : \ , ; [ ] %).

const { escapeDrawtext, safeColor, safeFontPath, safeExpr, safeNum } = require('../../server/utils/ffmpegSafe');

describe('escapeDrawtext', () => {
  test('neutralizes the quote that would close the text literal', () => {
    const out = escapeDrawtext("white':x=0:y=0:text='PWN");
    expect(out).not.toContain("'"); // no raw single quote survives
  });

  test('escapes every drawtext-special char', () => {
    const out = escapeDrawtext('a:b,c;d[e]f%g\\h`i');
    expect(out).toContain('\\:');
    expect(out).toContain('\\,');
    expect(out).toContain('\\;');
    expect(out).toContain('\\[');
    expect(out).toContain('\\]');
    expect(out).toContain('\\%');
    expect(out).toContain('\\`');
    expect(out).toContain('\\\\'); // backslash escaped
  });

  test('collapses newlines and caps length', () => {
    expect(escapeDrawtext('a\nb\r\nc')).toBe('a b c');
    expect(escapeDrawtext('x'.repeat(500), 80)).toHaveLength(80);
  });

  test('null/undefined/non-string → empty string, never throws', () => {
    expect(escapeDrawtext(null)).toBe('');
    expect(escapeDrawtext(undefined)).toBe('');
    expect(escapeDrawtext(42)).toBe('42');
  });
});

describe('safeColor', () => {
  test('accepts valid color tokens unchanged', () => {
    expect(safeColor('#fff')).toBe('#fff');
    expect(safeColor('#1a2b3c')).toBe('#1a2b3c');
    expect(safeColor('white')).toBe('white');
    expect(safeColor('black@0.8')).toBe('black@0.8');
    expect(safeColor('0xRRGG' )).toBe('white'); // invalid hex digits → fallback
    expect(safeColor('0x112233')).toBe('0x112233');
  });

  test('converts rgb()/rgba() to a safe 0xRRGGBB token', () => {
    expect(safeColor('rgb(0,0,0)')).toBe('0x000000');
    expect(safeColor('rgba(255,255,255,0.5)')).toBe('0xffffff@0.5');
  });

  test('rejects injection attempts → fallback', () => {
    expect(safeColor("white':drawbox=1")).toBe('white'); // fallback default
    expect(safeColor('red:x=0', 'black')).toBe('black');
    expect(safeColor('a,b', 'black')).toBe('black');
    expect(safeColor('', 'black')).toBe('black');
    expect(safeColor(null, 'black')).toBe('black');
  });
});

describe('safeFontPath', () => {
  test('forward-slashes and escapes the ffmpeg colon', () => {
    expect(safeFontPath('C:\\fonts\\Inter.ttf')).toBe('C\\:/fonts/Inter.ttf');
  });
  test('strips quotes/newlines; falsy → empty', () => {
    expect(safeFontPath("a'b\nc")).toBe('abc');
    expect(safeFontPath('')).toBe('');
    expect(safeFontPath(null)).toBe('');
  });
});

describe('safeExpr', () => {
  test('passes a valid position expression', () => {
    expect(safeExpr('(w-text_w)/2')).toBe('(w-text_w)/2');
    expect(safeExpr('h-th-50')).toBe('h-th-50');
  });
  test('rejects quotes/colons/commas → fallback', () => {
    expect(safeExpr("0':x=0:text='X", 'fallback')).toBe('fallback');
    expect(safeExpr('if(a,b)', '0')).toBe('0'); // comma rejected
    expect(safeExpr('', '(w-text_w)/2')).toBe('(w-text_w)/2');
  });
});

describe('safeNum', () => {
  test('coerces, defaults and clamps', () => {
    expect(safeNum('42')).toBe(42);
    expect(safeNum('abc', 7)).toBe(7);
    expect(safeNum(undefined, 5)).toBe(5);
    expect(safeNum(999, 0, 0, 100)).toBe(100); // clamp max
    expect(safeNum(-5, 0, 0, 100)).toBe(0); // clamp min
    expect(safeNum('3; rm -rf', 1)).toBe(1); // injection string → default
  });
});
