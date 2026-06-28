const { detectTextScript, notoFontForText } = require('../../server/utils/scriptFont');

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
