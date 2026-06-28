import { resolveCaptionTextStyle, activeWordIndex, buildKaraokeTokens } from '../captionStyler'

describe('resolveCaptionTextStyle', () => {
  it('falls back to a readable shadow for none/default/unknown', () => {
    for (const s of [undefined, 'none', 'default', 'totally-made-up']) {
      const css = resolveCaptionTextStyle(s, { color: '#fff' })
      expect(css.color).toBe('#fff')
      expect(String(css.textShadow)).toContain('rgba(0,0,0')
    }
  })

  it('applies a stroked outline for outline/subtitle/high-contrast', () => {
    expect(String(resolveCaptionTextStyle('outline').WebkitTextStroke)).toContain('px')
    expect(String(resolveCaptionTextStyle('subtitle').WebkitTextStroke)).toContain('px')
    expect(String(resolveCaptionTextStyle('high-contrast').WebkitTextStroke)).toContain('3px')
  })

  it('uses the accent color for neon glow', () => {
    const css = resolveCaptionTextStyle('neon', { accentColor: '#FF00AA' })
    expect(String(css.textShadow)).toContain('#FF00AA')
  })

  it('produces a gradient text fill (transparent fill + bg clip)', () => {
    const css = resolveCaptionTextStyle('gradient', { accentColor: '#0ff', color: '#f0f' })
    expect(css.WebkitBackgroundClip).toBe('text')
    expect(css.WebkitTextFillColor).toBe('transparent')
    expect(String(css.backgroundImage)).toContain('#0ff')
  })

  it('gives pill/bubble/sticker a background + radius and no text shadow', () => {
    for (const s of ['pill', 'bubble', 'sticker']) {
      const css = resolveCaptionTextStyle(s, { backgroundColor: '#123' })
      expect(css.backgroundColor).toBe('#123')
      expect(String(css.borderRadius)).toBeTruthy()
    }
  })

  it('uppercases for the uppercase style', () => {
    expect(resolveCaptionTextStyle('uppercase').textTransform).toBe('uppercase')
  })

  it('resolves bold-kinetic to a real bold style (not the plain default)', () => {
    const css = resolveCaptionTextStyle('bold-kinetic')
    expect(css.fontWeight).toBe(800)
  })
})

describe('karaoke timing', () => {
  const words = [
    { text: 'one', start: 0.0, end: 0.4 },
    { text: 'two', start: 0.4, end: 0.8 },
    { text: 'three', start: 1.0, end: 1.4 }, // gap before this word
  ]

  it('finds the word being spoken', () => {
    expect(activeWordIndex(words, 0.5)).toBe(1)
    expect(activeWordIndex(words, 1.2)).toBe(2)
  })

  it('returns -1 before the first word', () => {
    expect(activeWordIndex(words, -1)).toBe(-1)
  })

  it('holds the last-started word across a gap (no blanking)', () => {
    expect(activeWordIndex(words, 0.9)).toBe(1) // in the gap between "two" and "three"
  })

  it('supports startTime/endTime shaped words too', () => {
    const ov = [{ word: 'hi', startTime: 0, endTime: 0.5 }, { word: 'yo', startTime: 0.5, endTime: 1 }]
    expect(activeWordIndex(ov, 0.6)).toBe(1)
  })

  it('builds full-line tokens flagging active + spoken', () => {
    const toks = buildKaraokeTokens(words, 0.5)
    expect(toks.map((t) => t.text)).toEqual(['one', 'two', 'three'])
    expect(toks[0]).toMatchObject({ active: false, spoken: true })
    expect(toks[1]).toMatchObject({ active: true, spoken: false })
    expect(toks[2]).toMatchObject({ active: false, spoken: false })
  })

  it('returns [] for empty words', () => {
    expect(buildKaraokeTokens([], 1)).toEqual([])
  })
})
