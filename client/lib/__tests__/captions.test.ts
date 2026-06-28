import { normWord, pickHighlightWords, pickCaptionEmoji } from '../captions'

describe('normWord (Unicode-aware)', () => {
  it('lowercases and strips punctuation but keeps Latin letters/digits', () => {
    expect(normWord('Money!')).toBe('money')
    expect(normWord('100%')).toBe('100')
  })

  it('keeps accented Latin, CJK, Cyrillic, Arabic, Greek (not just a–z)', () => {
    expect(normWord('Café')).toBe('café')
    expect(normWord('投资,')).toBe('投资')
    expect(normWord('Москва')).toBe('москва')
    expect(normWord('مرحبا')).toBe('مرحبا')
    expect(normWord('Δόξα')).toBe('δόξα')
  })

  it('normalizes emoji / punctuation-only tokens to empty', () => {
    expect(normWord('💰')).toBe('')
    expect(normWord('—…')).toBe('')
  })
})

describe('pickHighlightWords (multi-language)', () => {
  it('highlights power words + numbers in English', () => {
    const hl = pickHighlightWords('The SECRET to 100x growth', 2)
    expect(hl.length).toBeGreaterThan(0)
    expect(hl).toContain('secret')
  })

  it('returns non-empty normalized words for non-Latin scripts (Cyrillic)', () => {
    const hl = pickHighlightWords('Большой секрет успеха здесь', 2)
    expect(hl.every((w) => w.length > 0)).toBe(true)
    // every token kept its Cyrillic letters (was stripped to '' before the fix)
    expect(hl.some((w) => /[Ѐ-ӿ]/.test(w))).toBe(true)
  })

  it('does NOT highlight a whole space-less CJK line (no giant single token)', () => {
    const hl = pickHighlightWords('这是一个非常长的中文字幕没有空格所以会变成一个超长的词', 2)
    // The single >24-char token is skipped, so nothing (or only short tokens) returns.
    expect(hl.every((w) => w.length <= 24)).toBe(true)
  })

  it('never emits an empty string', () => {
    for (const t of ['💰💰💰', '...', '   ', '']) {
      expect(pickHighlightWords(t, 3).includes('')).toBe(false)
    }
  })
})

describe('pickCaptionEmoji', () => {
  it('matches English keywords', () => {
    expect(pickCaptionEmoji('make more money')).toBe('💰')
  })
  it('returns empty (no false emoji) for non-matching / non-English text', () => {
    expect(pickCaptionEmoji('投资理财')).toBe('')
    expect(pickCaptionEmoji('zzz qqq')).toBe('')
  })
})
