const { escapeDrawtext } = require('../../server/utils/ffmpegSafe');

describe('escapeDrawtext — multi-language safety', () => {
  it('preserves non-Latin scripts (does not strip CJK / Arabic / Cyrillic / accents)', () => {
    expect(escapeDrawtext('你好世界')).toBe('你好世界');
    expect(escapeDrawtext('こんにちは')).toBe('こんにちは');
    expect(escapeDrawtext('안녕하세요')).toBe('안녕하세요');
    expect(escapeDrawtext('مرحبا')).toBe('مرحبا');
    expect(escapeDrawtext('Здравствуй')).toBe('Здравствуй');
    expect(escapeDrawtext('café piñata Über')).toContain('café');
  });

  it('still escapes filtergraph-dangerous characters', () => {
    const out = escapeDrawtext("a:b,c;d`e[f]g%h");
    expect(out).toContain('\\:');
    expect(out).toContain('\\,');
    expect(out).toContain('\\;');
    expect(out).toContain('\\`');
    expect(out).toContain('\\[');
    expect(out).toContain('\\]');
    expect(out).toContain('\\%');
    // single quote becomes a typographic quote (can't close the drawtext literal)
    expect(escapeDrawtext("it's")).not.toContain("'");
  });

  it('truncates by code point so an emoji / surrogate pair is never split into a lone half', () => {
    // 5 emoji = 10 UTF-16 code units; a naive slice(0,5) would cut mid-pair → '�'.
    const out = escapeDrawtext('😀😀😀😀😀', 3);
    expect([...out]).toHaveLength(3); // 3 whole emoji
    expect(out).not.toContain('�'); // no replacement char
    expect(out.includes('\uD800') || out.includes('\uDC00')).toBe(false); // no lone surrogate
  });

  it('handles null / undefined safely', () => {
    expect(escapeDrawtext(null)).toBe('');
    expect(escapeDrawtext(undefined)).toBe('');
  });
});
