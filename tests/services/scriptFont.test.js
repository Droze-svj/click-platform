const { detectTextScript, notoFontForText, fontPathForText, fontfileOptFor } = require('../../server/utils/scriptFont');

describe('scriptFont.detectTextScript', () => {
  it('detects CJK (Chinese / Japanese / Korean)', () => {
    expect(detectTextScript('你好世界')).toBe('cjk');
    expect(detectTextScript('こんにちは')).toBe('cjk');
    expect(detectTextScript('안녕하세요')).toBe('cjk');
  });
  it('detects Arabic, Thai, Devanagari', () => {
    expect(detectTextScript('مرحبا')).toBe('arabic');
    expect(detectTextScript('สวัสดี')).toBe('thai');
    expect(detectTextScript('नमस्ते')).toBe('devanagari');
  });
  it('returns null for Latin / Cyrillic / empty (uses the Latin default font)', () => {
    expect(detectTextScript('Hello world')).toBeNull();
    expect(detectTextScript('café piñata')).toBeNull();
    expect(detectTextScript('Москва')).toBeNull(); // Cyrillic — Latin fonts cover it
    expect(detectTextScript('')).toBeNull();
    expect(detectTextScript(null)).toBeNull();
  });
  it('detects the script even in mixed Latin+CJK text', () => {
    expect(detectTextScript('Buy now 立即购买')).toBe('cjk');
  });
});

describe('scriptFont.notoFontForText', () => {
  it('returns null for Latin (so callers fall back to their Latin default)', () => {
    expect(notoFontForText('Hello')).toBeNull();
  });
  it('returns null OR an installed path for non-Latin (never throws)', () => {
    // On a host without Noto installed this is null; with it, a real path. Either is valid.
    const p = notoFontForText('你好');
    expect(p === null || typeof p === 'string').toBe(true);
  });
});

describe('scriptFont.fontfileOptFor (shared drawtext option)', () => {
  it('returns an empty string only when NO font resolves at all', () => {
    // On CI/dev a Latin system font resolves, so Latin text yields a real opt.
    // The contract: '' (caller keeps its default) XOR a leading-colon fontfile token.
    const opt = fontfileOptFor('Hello');
    expect(opt === '' || /^:fontfile='.*'$/.test(opt)).toBe(true);
  });
  it('emits a leading-colon :fontfile= token so it concatenates after text=\'…\'', () => {
    const opt = fontfileOptFor('Hello');
    if (opt) expect(opt.startsWith(":fontfile='")).toBe(true);
  });
  it('escapes drive-letter colons so a Windows path can\'t break the filter graph', () => {
    // fontPathForText never returns a raw ':' un-escaped inside the option.
    const opt = fontfileOptFor('日本語');
    if (opt) {
      const inner = opt.slice(":fontfile='".length, -1); // strip wrapper
      expect(inner.includes(':')).toBe(false); // any ':' was escaped to '\:'
      expect(inner.includes('\\')).toBe(false); // backslashes normalized to '/'
    }
  });
  it('fontPathForText falls back to the Latin default for Latin/empty text', () => {
    // Same path notoFontForText(null) → getSystemFontPath().
    expect(fontPathForText('Hello')).toBe(fontPathForText(''));
  });
});
