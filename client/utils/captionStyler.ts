/**
 * captionStyler.ts — resolve caption/text-overlay styles to concrete CSS, and
 * compute karaoke word state, for the LIVE preview canvas.
 *
 * The preview (RealTimeVideoPreview) historically rendered only 3 of the ~20
 * caption styles (neon / outline / shadow) and showed a single active karaoke
 * word. Competitors (CapCut/VEED) render the full styled line with the spoken
 * word emphasised. These pure helpers close that gap and are unit-tested.
 */

/** Plain CSS bag (avoids a React import so this stays node-testable). */
export type CaptionCss = Record<string, string | number>

export interface CaptionStyleInput {
  /** Base text color. */
  color?: string
  /** Accent color for highlights / gradients / neon glow. */
  accentColor?: string
  /** Background color for pill / bubble / sticker styles. */
  backgroundColor?: string
  /** Outline color for stroked styles. */
  outlineColor?: string
}

const DEFAULTS = {
  color: '#FFFFFF',
  accent: '#FFD54A',
  bg: 'rgba(0,0,0,0.85)',
  outline: '#000000',
}

/**
 * Resolve a caption style key (accepts both TextOverlayStyle and CaptionTextStyle
 * string values) to a CSS bag. Unknown / 'none' / 'default' → a subtle readable
 * shadow. Output is additive — spread it onto the element's inline style.
 */
export function resolveCaptionTextStyle(style: string | undefined | null, input?: CaptionStyleInput): CaptionCss {
  const color = input?.color || DEFAULTS.color
  const accent = input?.accentColor || DEFAULTS.accent
  const bg = input?.backgroundColor || DEFAULTS.bg
  const outline = input?.outlineColor || DEFAULTS.outline
  const softShadow = '0 2px 6px rgba(0,0,0,0.55)'
  const strongShadow = '0 3px 10px rgba(0,0,0,0.85)'

  switch ((style || 'default').toLowerCase()) {
    case 'none':
    case 'default':
      return { color, textShadow: softShadow }
    case 'minimal':
      return { color, fontWeight: 400, textShadow: '0 1px 3px rgba(0,0,0,0.4)' }
    case 'uppercase':
      return { color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', textShadow: softShadow }
    case 'bold':
      return { color, fontWeight: 800, textShadow: strongShadow }
    case 'outline':
    case 'subtitle':
      return { color, WebkitTextStroke: `2px ${outline}`, paintOrder: 'stroke fill', textShadow: softShadow }
    case 'shadow':
      return { color, textShadow: '0 4px 14px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.9)' }
    case 'high-contrast':
      return { color: '#FFFFFF', fontWeight: 800, WebkitTextStroke: `3px #000000`, paintOrder: 'stroke fill', textShadow: strongShadow }
    case 'pill':
      return { color, backgroundColor: bg, padding: '0.12em 0.5em', borderRadius: '9999px', textShadow: 'none' }
    case 'bubble':
      return { color, backgroundColor: bg, padding: '0.18em 0.6em', borderRadius: '0.9em', textShadow: 'none' }
    case 'sticker':
      return { color, fontWeight: 800, backgroundColor: bg, padding: '0.16em 0.55em', borderRadius: '0.5em', boxShadow: '0 4px 0 rgba(0,0,0,0.35)', textShadow: 'none' }
    case 'neon':
      return { color, textShadow: `0 0 6px ${accent}, 0 0 14px ${accent}, 0 0 26px ${accent}` }
    case 'kinetic':
    case 'bold-kinetic':
    case 'karaoke':
      return { color, fontWeight: 800, textShadow: strongShadow }
    case 'cinematic':
      return { color, fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0.02em', textShadow: softShadow }
    case 'serif':
      return { color, fontFamily: 'Georgia, "Times New Roman", serif', textShadow: softShadow }
    case 'retro':
      return { color: '#FFE0B2', fontWeight: 700, textShadow: `0 2px 0 ${accent}, 0 3px 8px rgba(0,0,0,0.6)` }
    case 'vintage':
      return { color: '#F3E5AB', fontFamily: 'Georgia, serif', textShadow: '0 2px 6px rgba(60,40,10,0.7)' }
    case 'pop':
      return { color, fontWeight: 800, WebkitTextStroke: `2px ${outline}`, paintOrder: 'stroke fill', textShadow: `0 0 10px ${accent}` }
    case 'gradient':
      return {
        backgroundImage: `linear-gradient(92deg, ${accent}, ${color})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
        fontWeight: 800,
        textShadow: 'none',
      }
    default:
      return { color, textShadow: softShadow }
  }
}

export interface KaraokeWord {
  text?: string
  word?: string
  start?: number
  end?: number
  startTime?: number
  endTime?: number
}

export interface KaraokeToken {
  text: string
  /** This word is being spoken at the current time. */
  active: boolean
  /** This word has already been spoken (before the active word). */
  spoken: boolean
}

const wStart = (w: KaraokeWord) => (typeof w.start === 'number' ? w.start : (w.startTime ?? 0))
const wEnd = (w: KaraokeWord) => (typeof w.end === 'number' ? w.end : (w.endTime ?? wStart(w)))
const wText = (w: KaraokeWord) => (w.text ?? w.word ?? '')

/**
 * Index of the word being spoken at time `t`. Falls back to the last word whose
 * start has passed (so the caption doesn't blank between words), or -1 before
 * the first word.
 */
export function activeWordIndex(words: KaraokeWord[] | undefined | null, t: number): number {
  if (!words || words.length === 0) return -1
  let lastStarted = -1
  for (let i = 0; i < words.length; i++) {
    const s = wStart(words[i])
    const e = wEnd(words[i])
    if (t >= s && t < e) return i
    if (t >= s) lastStarted = i
  }
  return lastStarted
}

/**
 * Build the FULL karaoke line as tokens, each flagged active/spoken — so the
 * preview renders the whole caption with the current word emphasised (CapCut
 * style) instead of only showing one word at a time.
 */
export function buildKaraokeTokens(words: KaraokeWord[] | undefined | null, t: number): KaraokeToken[] {
  if (!words || words.length === 0) return []
  const active = activeWordIndex(words, t)
  return words.map((w, i) => ({
    text: wText(w),
    active: i === active,
    spoken: active >= 0 && i < active,
  }))
}
