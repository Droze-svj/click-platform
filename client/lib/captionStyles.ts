/**
 * Caption styles — client MIRROR of server/services/captionStyleRegistry.js.
 *
 * KEEP IN PARITY with the server: identical ids, or the editor preview won't
 * match the exported MP4. tests/server/captionStyleRegistry.test.js text-parses
 * this file and fails CI if the id sets diverge.
 *
 * The server turns each record into an ASS `Style:` line for the burn-in; this
 * mirror turns the same record into a CSS bag for RealTimeVideoPreview. One
 * record, two renderings — that is the whole point.
 */

export type CaptionKaraokeMode = 'word' | 'sweep' | 'none'
export type CaptionWordAnim = 'pop' | 'none'

export interface CaptionStyle {
  id: string
  label: string
  /** CSS font stack for preview. The server maps this family to a fontconfig name. */
  fontFamily: string
  /** Baseline px for a 1080-WIDE frame; scaled to the preview stage. */
  fontSize: number
  primary: string
  secondary: string
  highlight: string
  outline: string
  outlineW: number
  shadow: number
  box: false | 'opaque'
  uppercase: boolean
  letterSpacing: number
  /** ASS numpad alignment: 2 = bottom-center, 5 = middle-center. */
  align: number
  /** Bottom margin as a FRACTION of frame height (never fixed px). */
  marginVPct: number
  maxWordsPerLine: number
  karaoke: CaptionKaraokeMode
  wordAnim: CaptionWordAnim
  popScale: number
  /** Tailwind gradient classes for the swatch chip (UI only). */
  swatch: string
}

export const CAPTION_STYLES: CaptionStyle[] = [
  { id: 'hormozi', label: 'Hormozi', fontFamily: '"Montserrat", sans-serif', fontSize: 82, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700', outline: '#000000', outlineW: 5, shadow: 2, box: false, uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 118, swatch: 'from-yellow-300 via-amber-400 to-yellow-500' },
  { id: 'mrbeast', label: 'MrBeast', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 88, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FF3B30', outline: '#000000', outlineW: 6, shadow: 3, box: false, uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.17, maxWordsPerLine: 3, karaoke: 'word', wordAnim: 'pop', popScale: 125, swatch: 'from-red-400 via-rose-500 to-orange-500' },
  { id: 'karaoke-fill', label: 'Karaoke Fill', fontFamily: '"Montserrat", sans-serif', fontSize: 74, primary: '#FFE500', secondary: '#FFFFFF', highlight: '#FFE500', outline: '#000000', outlineW: 4, shadow: 2, box: false, uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18, maxWordsPerLine: 5, karaoke: 'sweep', wordAnim: 'none', popScale: 100, swatch: 'from-yellow-200 via-yellow-400 to-amber-500' },
  { id: 'clean-minimal', label: 'Clean Minimal', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 58, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFFFFF', outline: '#000000', outlineW: 2, shadow: 1, box: false, uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.14, maxWordsPerLine: 7, karaoke: 'none', wordAnim: 'none', popScale: 100, swatch: 'from-gray-200 via-gray-300 to-gray-400' },
  { id: 'neon', label: 'Neon', fontFamily: '"Montserrat", sans-serif', fontSize: 72, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#00F5FF', outline: '#00A0B0', outlineW: 4, shadow: 4, box: false, uppercase: true, letterSpacing: 1, align: 2, marginVPct: 0.18, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 115, swatch: 'from-cyan-300 via-sky-400 to-blue-500' },
  { id: 'pill', label: 'Pill', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 62, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700', outline: '#000000', outlineW: 0, shadow: 0, box: 'opaque', uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.16, maxWordsPerLine: 5, karaoke: 'word', wordAnim: 'none', popScale: 100, swatch: 'from-slate-700 via-slate-800 to-black' },
  { id: 'sticker', label: 'Sticker', fontFamily: '"Montserrat", sans-serif', fontSize: 68, primary: '#111111', secondary: '#111111', highlight: '#E11D48', outline: '#FFFFFF', outlineW: 5, shadow: 3, box: false, uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.18, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 120, swatch: 'from-white via-rose-200 to-rose-400' },
  { id: 'cyberpunk', label: 'Cyberpunk', fontFamily: '"Montserrat", sans-serif', fontSize: 74, primary: '#E9FBFF', secondary: '#E9FBFF', highlight: '#FF2D95', outline: '#1B0033', outlineW: 4, shadow: 4, box: false, uppercase: true, letterSpacing: 2, align: 2, marginVPct: 0.19, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 122, swatch: 'from-fuchsia-500 via-purple-500 to-cyan-400' },
  { id: 'serif-doc', label: 'Documentary', fontFamily: 'Georgia, "Liberation Serif", serif', fontSize: 54, primary: '#F5F5F0', secondary: '#F5F5F0', highlight: '#E8C57A', outline: '#000000', outlineW: 2, shadow: 2, box: false, uppercase: false, letterSpacing: 0, align: 2, marginVPct: 0.12, maxWordsPerLine: 8, karaoke: 'none', wordAnim: 'none', popScale: 100, swatch: 'from-stone-300 via-stone-500 to-stone-700' },
  // ── Legacy CAPTION_STYLE_MAP ids, preserved so existing projects don't shift ──
  { id: 'hook', label: 'Hook', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 82, primary: '#FFD700', secondary: '#FFD700', highlight: '#FFFFFF', outline: '#FFD700', outlineW: 4, shadow: 4, box: 'opaque', uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1875, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 118, swatch: 'from-yellow-300 to-amber-500' },
  { id: 'stat', label: 'Stat', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 72, primary: '#00FFFF', secondary: '#00FFFF', highlight: '#FFFFFF', outline: '#00FFFF', outlineW: 3, shadow: 3, box: 'opaque', uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 115, swatch: 'from-cyan-300 to-teal-500' },
  { id: 'question', label: 'Question', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 64, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700', outline: '#FFFFFF', outlineW: 2, shadow: 2, box: 'opaque', uppercase: true, letterSpacing: 0, align: 5, marginVPct: 0.45, maxWordsPerLine: 5, karaoke: 'none', wordAnim: 'none', popScale: 100, swatch: 'from-white to-gray-400' },
  { id: 'punchline', label: 'Punchline', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 76, primary: '#FF3366', secondary: '#FF3366', highlight: '#FFFFFF', outline: '#FF3366', outlineW: 3, shadow: 4, box: 'opaque', uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667, maxWordsPerLine: 4, karaoke: 'word', wordAnim: 'pop', popScale: 122, swatch: 'from-rose-400 to-pink-600' },
  { id: 'cta', label: 'Call to Action', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 60, primary: '#FFD700', secondary: '#FFD700', highlight: '#FFFFFF', outline: '#FFD700', outlineW: 2, shadow: 2, box: 'opaque', uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.125, maxWordsPerLine: 5, karaoke: 'none', wordAnim: 'none', popScale: 100, swatch: 'from-amber-300 to-yellow-500' },
  { id: 'default', label: 'Default', fontFamily: '"Liberation Sans", Arial, sans-serif', fontSize: 58, primary: '#FFFFFF', secondary: '#FFFFFF', highlight: '#FFD700', outline: '#000000', outlineW: 2, shadow: 2, box: 'opaque', uppercase: true, letterSpacing: 0, align: 2, marginVPct: 0.1667, maxWordsPerLine: 6, karaoke: 'none', wordAnim: 'none', popScale: 100, swatch: 'from-gray-300 to-gray-500' },
]

/**
 * Legacy spellings → canonical id. MIRROR of the server ALIASES map: a value
 * that resolves on the server must resolve here, or the preview silently shows
 * a different style than the export.
 */
export const CAPTION_STYLE_ALIASES: Record<string, string> = {
  'bold-kinetic': 'hormozi',
  'bold': 'mrbeast',
  'tiktok': 'hormozi',
  'tiktok-pop': 'hormozi',
  'minimal': 'clean-minimal',
  'modern': 'clean-minimal',
  'professional': 'serif-doc',
  'outline': 'mrbeast',
  'serif': 'serif-doc',
  'kinetic': 'hormozi',
  'karaoke': 'karaoke-fill',
  'gradient': 'neon',
  'pop': 'sticker',
  'bubble': 'pill',
  'cinematic': 'serif-doc',
  'uppercase': 'mrbeast',
  'shadow': 'clean-minimal',
  'high-contrast': 'clean-minimal',
  'subtitle': 'clean-minimal',
  'retro': 'sticker',
  'vintage': 'serif-doc',
  'reels': 'hormozi',
  'podcast': 'serif-doc',
  'documentary': 'serif-doc',
  'accessible': 'clean-minimal',
  'neon-glitch': 'cyberpunk',
  'cyberpunk_neon': 'cyberpunk',
  'hormozi-bold': 'hormozi',
  'mrbeast-energy': 'mrbeast',
  'none': 'default',
}

const _byId = new Map(CAPTION_STYLES.map((s) => [s.id, s]))

export function normalizeCaptionStyleId(id: string | null | undefined): string {
  const key = String(id || '').trim().toLowerCase()
  return CAPTION_STYLE_ALIASES[key] || key
}

export function resolveCaptionStyle(id: string | null | undefined): CaptionStyle | null {
  return _byId.get(normalizeCaptionStyleId(id)) || null
}

/** Always a record — unknown ids fall back to `default`, matching the server. */
export function resolveCaptionStyleOrDefault(id: string | null | undefined): CaptionStyle {
  return resolveCaptionStyle(id) || (_byId.get('default') as CaptionStyle)
}

export function captionStyleIds(): string[] {
  return CAPTION_STYLES.map((s) => s.id)
}

/**
 * A style → inline CSS for the preview. `stageWidth` scales the 1080-baseline
 * font to the actual preview box so long captions wrap the same way the export
 * does — the single biggest source of preview/export drift before this.
 */
export function captionStyleToCss(
  id: string | null | undefined,
  opts: { stageWidth?: number; active?: boolean } = {},
): Record<string, string | number | undefined> {
  const s = resolveCaptionStyleOrDefault(id)
  const scale = Math.max(0.1, (opts.stageWidth || 1080) / 1080)
  const css: Record<string, string | number | undefined> = {
    fontFamily: s.fontFamily,
    fontSize: `${Math.round(s.fontSize * scale)}px`,
    color: opts.active ? s.highlight : s.primary,
    fontWeight: 800,
    lineHeight: 1.22,
    textTransform: s.uppercase ? 'uppercase' : undefined,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
  }
  if (s.box === 'opaque') {
    css.backgroundColor = 'rgba(0,0,0,0.85)'
    css.padding = '0.12em 0.5em'
    css.borderRadius = s.id === 'pill' ? '9999px' : '0.35em'
  } else {
    css.WebkitTextStroke = `${Math.max(0, s.outlineW * scale)}px ${s.outline}`
    css.paintOrder = 'stroke fill'
    css.textShadow = s.shadow
      ? `0 ${s.shadow * scale}px ${s.shadow * 3 * scale}px rgba(0,0,0,0.85)`
      : undefined
  }
  if (opts.active && s.wordAnim === 'pop') {
    css.transform = `scale(${s.popScale / 100})`
    css.display = 'inline-block'
  }
  return css
}
